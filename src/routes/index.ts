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
import {
    DeleteRuleCommand,
    EventBridgeClient,
    ListRulesCommand,
    ListTargetsByRuleCommand,
    PutRuleCommand,
    PutTargetsCommand,
    RemoveTargetsCommand,
} from '@aws-sdk/client-eventbridge';


dotenv.config();
const router = Router();
const queueArn = "arn:aws:sqs:eu-west-2:224164455438:UpdateResultsQueue"
const CODE_MAPPING = JSON.parse(fs.readFileSync('src/mapping.json', 'utf8'));

async function createEventBridgeRuleToSQS(frequency: number, alertId: number) {
    const ruleName = `vintedbot-lambda-${alertId}`;
    const eventBridgeClient = new EventBridgeClient({});

    // Step 2: Create an EventBridge rule that triggers at the specified frequency
    await eventBridgeClient.send(
        new PutRuleCommand({
            Name: ruleName,
            ScheduleExpression: `rate(${frequency} minutes)`,
        })
    );

    // Step 4: Add SQS queue as the target of the EventBridge rule
    await eventBridgeClient.send(
        new PutTargetsCommand({
            Rule: ruleName,
            Targets: [{
                Id: 'SqsQueueTarget',
                Arn: queueArn,
                Input: JSON.stringify({
                    alert_id: alertId
                }),
            }, ],
        })
    );

    console.log('EventBridge rule created successfully.');
}

const notificatioNFrequencyToMinutes = (notificationFrequency: number) => {
    switch (notificationFrequency) {
        case 0: // 5 minutes
            return 5;
        case 1: // 10 minutes
            return 10;
        case 2: // 30 minutes
            return 30;
        case 3: // 1 hour
            return 60;
        case 4: // 1 day
            return 1440;
        default:
            throw new Error('Invalid notification frequency');
    }
}

async function deleteEventBridgeRule(alertId: number) {
    const ruleName = `vintedbot-lambda-${alertId}`;
    const eventBridgeClient = new EventBridgeClient({});

    // Step 1: List the targets for the rule
    const listTargetsResponse = await eventBridgeClient.send(
        new ListTargetsByRuleCommand({
            Rule: ruleName,
        })
    );

    if (!listTargetsResponse.Targets) {
        console.log('No targets found for rule:', ruleName);
        return;
    }

    // Step 2: If there are targets, remove them
    const targetIds = listTargetsResponse.Targets.map(target => target.Id);
    if (targetIds.length > 0) {
        await eventBridgeClient.send(
            new RemoveTargetsCommand({
                Rule: ruleName,
                Ids: targetIds as string[],
            })
        );
    }

    // Step 3: Now delete the rule
    await eventBridgeClient.send(
        new DeleteRuleCommand({
            Name: ruleName,
        })
    );
}

async function listAllRules(): Promise<number[]> {
    const eventBridgeClient = new EventBridgeClient({});
    const response = await eventBridgeClient.send(new ListRulesCommand({}));
    const ids: number[] = [];

    if (response.Rules === undefined) {
      throw new Error(`response.Rules is undefined, response must be malformed`);
    }

    for (const rule of response.Rules) {
      if(!rule.Name){
        throw new Error(`rule with no name was returned, response must be malformed`);
      }

      if(!rule.Name.includes('vintedbot-lambda')){
        continue;
      }

      // Get ID from name
      const splitName = rule.Name.split('-');
      if (splitName.length < 3) {
        throw new Error(`rule name wasn't able to be split, ${rule.Name}`);
      }

      const id = splitName[2];

      // If can't parse ID as int then throw
      let idInt = parseInt(id);
      if (isNaN(idInt)) {
        throw new Error(`rule id wasn't able to be converted to a number, ${id}`);
      }

      ids.push(idInt);
    }

    return ids;
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// Middleware
router.use(express.json());

(async () => {
    const alerts = await Alerts.findAll();

    const ruleIds = await listAllRules();
    const alertIds = alerts.map(alert => alert.id);

    // Check to see if there are any alerts that don't have a rule
    for (const alert of alerts) {
        if (!ruleIds.includes(alert.id)) {
            console.log(`Creating rule for alert ${alert.id}`);
            await createEventBridgeRuleToSQS(notificatioNFrequencyToMinutes(alert.notification_frequency), alert.id);
            
            // Stagger the rule creation to avoid rate limiting
            await delay(1000);
        }
    }

    // Check for rules that don't have an alert
    for (const id of ruleIds) {
        if (!alertIds.includes(id)) {
            console.log(`Deleting rule for alert ${id}`);
            await deleteEventBridgeRule(id);
        }
    }
})();


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
            verified: false,
            last_active: new Date(),
            role: 'user'
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

        user.last_active = new Date();
        await user.save();

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

const startTask = async (alert_id: number): Promise<void> => {
    try {
        const response = await fetch(`https://3aw6qin8ol.execute-api.eu-west-2.amazonaws.com/Prod/update-results/${alert_id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            // Attempt to parse error response
            let errorResponse = '';
            try {
                const res = await response.json();
                if (res && res.message) {
                    errorResponse = res.message;
                } else {
                    errorResponse = 'parsed json but no message found';
                }
            } catch (parseError) {
                const errorMessage = (parseError instanceof Error && parseError.message) ? parseError.message : 'An unknown error occurred';
                errorResponse = 'could not parse error response, ' + errorMessage;
            }
            throw new Error(`got status ${response.status}: ${errorResponse}`);
        }

        console.log(`Successfully fetched results for alert ${alert_id}`);
    } catch (error) {
        const errorMessage = (error instanceof Error && error.message) ? error.message : 'An unknown error occurred';
        console.error(`error fetching results for alert ${alert_id}:`, errorMessage);
    }
};

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

        // Query the users table to get the user's role
        const userDetails = await User.findOne({
            where: {
                id: user.id
            }
        });

        if (!userDetails) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        let maxAlerts;
        if (userDetails.role === 'user' || userDetails.role === null) {
            maxAlerts = 6;
        } else if (userDetails.role === 'paid') {
            maxAlerts = 30;
        } else {
            return res.status(400).json({
                error: 'Invalid user role'
            });
        }

        const alertCount = await Alerts.count({
            where: {
                user_id: user.id
            }
        });
        if (alertCount >= maxAlerts) {
            return res.status(400).json({
                error: `Maximum number of alerts (${maxAlerts}) reached`
            });
        }

        console.log(`Creating alert (${alert.name}) for user ${user.id}`);

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
        }).then(async (alert) => {

            try {
                await startTask(alert.id); // Start the task immediately

                // Now create the schedule
                await createEventBridgeRuleToSQS(notificatioNFrequencyToMinutes(alert.notification_frequency), alert.id);

                return res.status(200).json({});

            } catch (error) {
                console.error('Error creating alert job:', error);
                await Alerts.destroy({
                    where: {
                        id: alert.id
                    }
                });

                return res.status(500).json({
                    error: (error as Error).message
                });
            }

        }).catch((error) => {
            console.error('Error adding alert to database:', error);
            return res.status(400).json({
                error: (error as Error).message
            });
        });
    } catch (error) {
        console.error('Error creating alert:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.delete('/delete-alert', authenticateToken, (req: any, res: any) => {
    try {
        let idInt = parseInt(req.body.id);
        Alerts.destroy({
                where: {
                    id: idInt,
                    user_id: req.user.id
                }
            })
            .then(() => {
                deleteEventBridgeRule(idInt)
                    .then(() => {
                        return res.status(200).json({});
                    })
                    .catch((error) => {
                        console.error('Error deleting EventBridge rule:', error);
                        return res.status(500).json({
                            error: 'Failed to delete EventBridge rule'
                        });
                    });
            })
            .catch((error) => {
                return res.status(500).json({
                    error: (error as Error).message
                });
            });
    } catch (error) {
        console.error('Error deleting alert:', error);
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
    } catch (error) {
        console.error('Error creating alert:', error);
        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.get('/get-mapping', authenticateToken, (req: any, res: any) => {
    try {
        return res.json(CODE_MAPPING);
    } catch (error) {
        console.error('Error creating alert:', error);
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
                    },
                    order: [['created_at', 'DESC']] // Sort by created_at in descending order

                })
            };
        }));

        return res.json(results);
    } catch (error) {
        console.error('Error creating alert:', error);

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
    } catch (error) {
        console.error('Error creating alert:', error);
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
    } catch (error) {
        console.error('Error creating alert:', error);

        return res.status(500).json({
            error: 'Internal server error'
        });
    }
});

export default router;