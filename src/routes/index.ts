import User from '../models/user.model';
import Session from '../models/sessions.model';
import Alerts from '../models/alerts.model';
import Results from '../models/results.model';
import Mapping from '../models/mapping.model';
import {
    Router
} from 'express';
import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import {
    ACCESS_TOKEN_SECRET,
    authenticateToken,
    generateAccessToken,
    generateEmailToken,
    generateRefreshToken,
    getAccessToken,
    getUserFromAccessToken,
    REFRESH_TOKEN_SECRET,
    getSecretValue
} from './helper';
import fs from 'fs';
const jobManager = require('./jobManager');
const CODE_MAPPING = JSON.parse(fs.readFileSync('src/mapping.json', 'utf8'));

dotenv.config();
const router = Router();

const NODE_ENV = process.env.NODE_ENV;


const notificationFreqToCron = (notificationFrequency: number) => {
    switch (notificationFrequency) {
        case 0: // 5 minutes
            return '*/5 * * * *';
        case 1: // 10 minutes
            return '*/10 * * * *';
        case 2: // 30 minutes
            return '*/30 * * * *';
        case 3: // 1 hour
            return '0 * * * *';
        case 4: // 1 day
            return '0 0 * * *';
        default:
            throw new Error('Invalid notification frequency');
    }
}

const startTask = (alert_id: number) => {
    fetch(`https://3aw6qin8ol.execute-api.eu-west-2.amazonaws.com/Prod/update-results/${alert_id}`)
    .then((response) => {
        if (!response.ok) {
            // Check if the response has content before parsing JSON
            return response.text().then((text) => {
                if (text) {
                    return JSON.parse(text).then((json: { success: boolean; message: string; }) => {
                        throw new Error(`response not ok, got ${response.status}, message: ${json.message}`);
                    });
                } else {
                    throw new Error(`response not ok, got ${response.status}, no message available`);
                }
            });
        }
        console.log(`Successfully fetched results for alert ${alert_id}`);
    })
    .catch((error) => {
        console.error(`Error fetching results for alert ${alert_id}:`, error);
    });

    
};

if(NODE_ENV === "prod"){
    Alerts.findAll().then((alerts) => {
        alerts.forEach((result) => {
            jobManager.scheduleJob(result.id, notificationFreqToCron(result.notification_frequency), () => startTask(result.id));
        });
    }).catch((error) => {
        console.error('Error fetching results:', error);
    });
}

// Middleware
router.use(express.json());


router.post('/password-update', authenticateToken, async (req: any, res: any) => {
    try {


        const user = await User.findOne({
            where: {
                id: req.user.id
            }
        });
        if (!user) return res.status(403).json({});

        const {
            currentPassword,
            newPassword
        } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({});

        // @ts-ignore
        if (!user.validPassword(currentPassword)) return res.status(403).json({});

        user.password = newPassword

        await user.save();
        return res.status(204).json({});
    } catch (error) {
        return res.status(500).json({
            error: (error as Error).message
        });
    }
});

function sendErrorPage(res: any, message: string) {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification Failed</title>
        <style>
            body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f0f0; }
            .container { text-align: center; padding: 2rem; background-color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            h1 { color: #e74c3c; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Email Verification Failed</h1>
            <p>${message}</p>
        </div>
    </body>
    </html>
    `;
    res.status(403).send(html);
}

function sendSuccessPage(res: any) {
    const html = `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verified</title>
    <style>
        @keyframes fadeIn {
            0% { opacity: 0; transform: scale(0.8); }
            100% { opacity: 1; transform: scale(1); }
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-20px); }
            60% { transform: translateY(-10px); }
        }
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #2e2e2e;
            color: #e0e0e0;
            animation: fadeIn 1s ease-in-out;
        }
        .container {
            text-align: center;
            padding: 2.5rem;
            background-color: #333;
            border-radius: 12px;
            box-shadow: 0 8px 12px rgba(0, 0, 0, 0.3);
            animation: fadeIn 0.8s ease-in-out;
        }
        h1 {
            color: #27ae60;
            font-size: 2rem;
            margin-bottom: 1rem;
            animation: bounce 2s infinite;
        }
        p {
            color: #b0b0b0;
            font-size: 1rem;
        }
        .checkmark {
            font-size: 3rem;
            color: #27ae60;
            margin-bottom: 1rem;
            animation: bounce 2s infinite;
        }
        button {
            background-color: #1d72b8;
            color: #fff;
            padding: 0.8rem 1.2rem;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 1.5rem;
            font-size: 1rem;
        }
        button:hover {
            background-color: #155a8a;
        }
    </style>
</head>
<body>
    <div class="container">
    <div class="checkmark">✅</div>
    <h1>Email Verified</h1>
    <p>Your email has been successfully verified. You can now login.</p>
    <button onclick="window.location.href = 'https://portal.vintedbot.co.uk/login';">Close</button>
</div>

</body>
</html>

    `;
    res.status(200).send(html);
}

router.get('/auth-email', async (req: any, res: any) => {
    try {

        // Get token from param
        const token = req.query.token;

        // Check if token is valid
        if (!token) return res.status(403).json({});

        // Decode token
        // Get email from token
        let email: string;
        try {
            const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
            email = (decoded as any).email;

            if (!email) {
                sendErrorPage(res, 'Email not found in token');
                return;
            }

        } catch (error) {
            console.error('Error decoding token:', error);
            sendErrorPage(res, 'Invalid token');
            return;
        }

        const user = await User.findOne({
            where: {
                email
            }
        });
        if (!user) {
            sendErrorPage(res, 'User not found');
            return;
        }
        user.verified = true;
        await user.save();

        sendSuccessPage(res);
    } catch (error) {
        console.error('Error verifying email:', error);
        sendErrorPage(res, 'Internal server error');
    }
});

router.post('/register', async (req: any, res: any) => {
    try {

        const RESEND_CREDS = await getSecretValue("RESEND_API_KEY") || process.env.RESEND_API_KEY;

        const {
            name,
            email,
            password
        } = req.body;

        const user = await User.create({
            name,
            email,
            password,
            created_at: new Date(),
            admin: false,
            verified: false
        });
        const emailToken = await generateEmailToken(email);

        const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f4f4f4;
                }
                .email-container {
                    background-color: #ffffff;
                    border-radius: 5px;
                    padding: 30px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                h1 {
                    color: #2c3e50;
                    margin-bottom: 20px;
                }
                p {
                    margin-bottom: 20px;
                }
                .button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #3498db;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    text-align: center;
                    transition: background-color 0.3s ease;
                }
                .button:hover {
                    background-color: #2980b9;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #7f8c8d;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <h1>Verify Your Email Address</h1>
                <p>Thank you for signing up! To complete your registration and start using our service, please verify your email address by clicking the button below:</p>
                <p style="text-align: center;">
                    <a href="https://api.vintedbot.co.uk/users/auth-email?token=${emailToken}" class="button">Verify Email Address</a>
                </p>
                <p>If you didn't create an account with us, you can safely ignore this email.</p>
                <div class="footer">
                    <p>This email was sent by VintedBot. Please do not reply to this message.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${RESEND_CREDS.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'alerts@updates.vintedbot.co.uk',
                to: user.email,
                subject: 'Verify your email',
                html: emailHtml
            }),
        });

        let response = await resendRes.json();
        if (!resendRes.ok) {
            throw new Error(`error sending email: ${response.message}`);
        }

        res.status(201).json({
            message: 'User created'
        });
    } catch (error) {
        return res.status(400).json({
            error: (error as Error).message
        });
    }
});

// Refresh token route
router.post('/token', async (req: any, res: any) => {
    try {

        const {
            token
        }: {
            token: string
        } = req.body;
        if (!token) return res.status(401).json({});

        // Check if the token is in db
        const session = await Session.findOne({
            where: {
                refresh_token: token
            }
        })
        if (!session) return res.status(403).json({});

        // Get user associated
        const user = await User.findOne({
            where: {
                id: session.user_id
            }
        });
        if (!user) return res.status(403).json({});

        await new Promise((resolve, reject) => {
            jwt.verify(token, REFRESH_TOKEN_SECRET, (err: any, decoded: any) => {
                if (err) return reject(err);
                resolve(decoded);
            });
        });

        // Generate new access token
        const accessToken = await generateAccessToken(user.id, user.email);

        return res.json({
            accessToken
        });
    } catch (error) {
        return res.status(500).json({
            error: (error as Error).message
        });
    }

});

router.post('/login', async (req: any, res: any) => {
    try {
        const user = await User.findOne({
            where: {
                email: req.body.email
            }
        });
        if (!user) {
            return await res.status(404).json({
                message: 'User not found'
            });
        }

        // @ts-ignore
        if (!user.validPassword(req.body.password)) {
            return await res.status(403).json({
                message: 'Invalid password'
            });
        }

        const accessToken = await generateAccessToken(user.id, user.email);
        const refreshToken = await generateRefreshToken(user.id, user.email);

        return res.json({
            accessToken,
            refreshToken,
            admin: user.admin
        });
    } catch (error) {
        return res.status(500).json({
            error: (error as Error).message
        });
    }
});

interface Include {
    word: string;
    must_be_included: boolean;
}

interface CreateAlert {
    name: string;
    category: number;
    brands: number[];
    conditions: number[];
    priceMin: number;
    priceMax: number;
    sizes: number[];
    includes: Include[];
    excluded: string[];
    notificationFrequency: number;
}

const validateNotificationFrequency = (notificationFrequency: number) => {

    // We are currently allowing 30 minutes, 1 hour and 1 day. 
    return notificationFrequency >= 2 && notificationFrequency <= 4;
}

router.post('/create-alert', authenticateToken, async (req: any, res: any) => {
    try {
        const alert: CreateAlert = req.body;

        if (!validateNotificationFrequency(alert.notificationFrequency)) {
            return res.status(400).json({
                error: 'Invalid notification frequency'
            });
        }

        const accessToken = await getAccessToken(req);
        if (!accessToken) return res.status(401).json({});

        const user = await getUserFromAccessToken(accessToken);
        if (!user) return res.status(403).json({});

        const alertCount = await Alerts.count({
            where: {
                user_id: user.id
            }
        });
        if (alertCount >= 5) return res.status(400).json({
            error: 'Too many alerts'
        });

        console.log(alert);

        // Create an alert, then a cron. If the cron fails to create, undo the creation of the alert.
        Alerts.create({
            name: alert.name,
            category: alert.category,
            brands: alert.brands,
            condition: alert.conditions,
            min_price: alert.priceMin,
            max_price: alert.priceMax,
            sizes: alert.sizes,
            keywords: [], // Deprecated
            includes: alert.includes,
            excluded: alert.excluded,
            notification_frequency: alert.notificationFrequency,
            user_id: user.id,
            created_at: new Date(),
            colour: [],
            category_friendly: '',
            brand_friendly: [],
            condition_friendly: [],
            results: [],
            // Add any other required properties here
        }).then((alert) => {

            try {
                // Start task first
                startTask(alert.id);

                // Then create the job
                jobManager.scheduleJob(alert.id, notificationFreqToCron(alert.notification_frequency), () => startTask(alert.id));
                return res.status(200).json({});

            } catch (error) {
                console.error('Error creating job:', error);
                Alerts.destroy({
                    where: {
                        id: alert.id
                    }
                });
                return res.status(500).json({
                    error: (error as Error).message
                });
            }

        }).catch((error) => {
            return res.status(400).json({
                error: (error as Error).message
            });
        });
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.delete('/delete-alert', authenticateToken, (req: any, res: any) => {
    try {
        Alerts.destroy({
            where: {
                id: req.body.id,
                user_id: req.user.id
            }
        }).then(() => {
            jobManager.cancelJob(req.body.id);
            return res.status(200).json({});
        }).catch((error) => {
            return res.status(500).json({
                error: (error as Error).message
            });
        });
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.get('/get-alerts', authenticateToken, (req: any, res: any) => {
    try {
        Alerts.findAll({
            where: {
                user_id: req.user.id
            }
        }).then((alerts) => {
            return res.json(alerts);
        }).catch((error) => {
            return res.status(500).json({
                error: (error as Error).message
            });
        });
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.get('/get-mapping', authenticateToken, (req: any, res: any) => {
    try {
        return res.json(CODE_MAPPING);
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.get('/get-results', authenticateToken, async (req: any, res: any) => {
    try {
        // Get all alerts for the user
        const alerts = await Alerts.findAll({
            where: {
                user_id: req.user.id
            }
        });
        if (!alerts) return res.status(404).json({});

        // Get all results for the alerts
        const results = await Promise.all(alerts.map(async (alert) => {
            return {
                alert,
                results: await Results.findAll({
                    where: {
                        alert_id: alert.id
                    }
                })
            };
        }));

        return res.json(results);
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.put('/update-mapping', authenticateToken, (req: any, res: any) => {
    try {
        Mapping.update(req.body, {
            where: {
                id: 1
            }
        }).then(() => {
            return res.status(204).json({});
        }).catch((error) => {
            return res.status(500).json({
                error: (error as Error).message
            });
        });
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.post('/update-results', authenticateToken, (req: any, res: any) => {
    try {
        Results.create(req.body).then((results) => {
            return res.status(201).json(results);
        }).catch((error) => {
            return res.status(400).json({
                error: (error as Error).message
            });
        });
    } catch {
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

export default router;