import User from '../models/user.model';
import Session from '../models/sessions.model';
import Alerts from '../models/alerts.model';
import Results from '../models/results.model';
import Mapping from '../models/mapping.model';
import { Router } from 'express';
import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
const jobManager = require('./jobManager');

dotenv.config();
const router = Router();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'youraccesstokensecret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'yourrefreshtokensecret';

// Read the mapping data
// var mapping = fs.readFileSync('./routes/code.json', 'utf8');
// var CODE_MAPPING = JSON.parse(mapping);

Alerts.findAll().then((alerts) => {
    alerts.forEach((result) => {
        console.log(`Found existing alert with ID ${result.id}, scheduling...`);
        jobManager.scheduleJob(result.id, '0 * * * *', () => {
            fetch(`https://3aw6qin8ol.execute-api.eu-west-2.amazonaws.com/Prod/update-results/${result.id}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`response not ok: ${response.statusText}`);
                }
                return response.json();
            })
            .then((data) => {
                console.log('Data fetched:', data);
            })
            .catch((error) => {
                console.error('error fetching data:', error);
            });
        });
    });
}).catch((error) => {
    console.error('Error fetching results:', error);
});

// Middleware
router.use(express.json());

async function generateAccessToken(email: string) {
    return jwt.sign({ email }, ACCESS_TOKEN_SECRET, { expiresIn: '1m' });
}

async function generateRefreshToken(user_id: number, email: string) {
    const refreshToken = jwt.sign({ email: email }, REFRESH_TOKEN_SECRET);

    await Session.create({
        user_id: user_id,
        refresh_token: refreshToken
    });

    return refreshToken;
}

async function getAccessToken(req: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    return token;
}

async function getUserFromAccessToken(token: string): Promise<User | null> {
    try {
        // Decode the token and extract the email
        const decoded = jwt.decode(token) as { email?: string };
        
        // Check if the email exists in the decoded token
        if (!decoded || !decoded.email) {
            throw new Error('Invalid token: email not found');
        }

        // Use the email to find the user in the database
        return await User.findOne({ where: { email: decoded.email } });
    } catch (error) {
        console.error('Error decoding token or finding user:', error);
        throw error;
    }
}

    

// Middleware to authenticate token
async function authenticateToken(req: any, res: any, next: any) {
    const token = await getAccessToken(req);

    if (!token) return res.status(401).json({});

    // // Check if the token is in db
    // const session = await Session.findOne({where: {refresh_token: token}})
    // if (!session) return res.status(403);

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err: any, user: any) => {
        
        // Tell the client they need to refresh the token
        if (err instanceof jwt.TokenExpiredError) return res.status(409).json({});

        // Otherwise tell the client the token is invalid, log them out.
        if (err) return res.status(403).json({});
        req.user = user;
        next();
    });
}

router.post('/password-update', authenticateToken, async (req: any, res: any) => {
    const accessToken = await getAccessToken(req);
    const user = await getUserFromAccessToken(accessToken);
    if(!user) return res.status(403).json({});

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({});

    // @ts-ignore
    if (!user.validPassword(currentPassword)) return res.status(403).json({});

    user.password = newPassword

    await user.save();
    return res.status(204).json({});
});


router.post('/register', async (req:any, res:any) => {
    try {
        const {name,email,password} = req.body;

        const user = await User.create({name,email,password,created_at: new Date()});
        
        const refreshToken = await generateRefreshToken(user.id, email);
        const accessToken = await generateAccessToken(email);

        return res.status(201).json({
            accessToken,
            refreshToken
        });
    } catch (error) {
        return res.status(400).json({
            error: (error as Error).message
        });
    }
});

// Refresh token route
router.post('/token', async (req: any, res: any) => {
    const { token }: {token: string} = req.body;
    if (!token) return res.status(401).json({});

    // Check if the token is in db
    const session = await Session.findOne({where: {refresh_token: token}})
    if (!session) return res.status(403).json({});

    // Get user associated
    const user = await User.findOne({where: {id: session.user_id}});
    if (!user) return res.status(403).json({});

    const decoded = await new Promise((resolve, reject) => {
        jwt.verify(token, REFRESH_TOKEN_SECRET, (err: any, decoded: any) => {
            if (err) return reject(err);
            resolve(decoded);
        });
    });

    // Generate new access token
    const accessToken = await generateAccessToken(user.email);

    return res.json({ accessToken });

});

// Protected route
router.get('/protected', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route.' });
});

router.post('/login', async (req: any, res: any) => {
    try {
        const user = await User.findOne({where: {email: req.body.email}});
        if(!user) {
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
        
        const accessToken = await generateAccessToken(user.email);
        const refreshToken = await generateRefreshToken(user.id, user.email);

        return res.json({ accessToken, refreshToken });
    } catch (error) {
        return res.status(500).json({
            error: (error as Error).message
        });
    }
});

interface CreateAlert {
    name: string;
    category: number;
    brands: number[];
    conditions: number[];
    priceMin: number;
    priceMax: number;
    sizes: number[];
    keywords: string[];
    notificationFrequency: string;
}

router.post('/create-alert', authenticateToken, async (req:any, res:any) => {
    const alert: CreateAlert = req.body;
    console.log('Alert:', alert);

    // Get user from token
    const accessToken = await getAccessToken(req);
    if(!accessToken) return res.status(401).json({});

    const user = await getUserFromAccessToken(accessToken);
    if(!user) return res.status(403).json({});

    // Create an alert, then a cron. If the cron fails to create, undo the creation of the alert.
    Alerts.create({
        name: alert.name,
        category: alert.category,
        brands: alert.brands,
        condition: alert.conditions,
        min_price: alert.priceMin,
        max_price: alert.priceMax,
        sizes: alert.sizes,
        keywords: alert.keywords,
        notification_frequency: alert.notificationFrequency,
        user_id: user.id,
        created_at: new Date(),
        freq: 0,
        colour: [],
        category_friendly: '',
        brand_friendly: [],
        condition_friendly: [],
        // Add any other required properties here
    }).then((alert) => {

        try {
            jobManager.scheduleJob(alert.id, '0 * * * *', () => {

                fetch(`https://3aw6qin8ol.execute-api.eu-west-2.amazonaws.com/Prod/update-results/${alert.id}`)
                .then((response) => {
                    if (!response.ok) {
                        throw new Error('Failed to fetch data');
                    }
                    return response.json();
                })
                .then((data) => {
                    console.log('Data fetched:', data);
                })
                .catch((error) => {
                    console.error('Error fetching data:', error);
                });
            });
            return res.status(200).json({});
            
        } catch (error) {
            console.error('Error creating job:', error);
            Alerts.destroy({where: {id: alert.id}});
            return res.status(500).json({
                error: (error as Error).message
            });
        }
    
    }).catch((error) => {
        return res.status(400).json({
            error: (error as Error).message
        });
    });
});

router.delete('/delete-alert', authenticateToken, (req, res) => {
    Alerts.destroy({where: {id: req.body.id}}).then(() => {

        console.log("Deleting job:", req.body.id);
        jobManager.cancelJob(req.body.id);
        return res.status(200).json({});
    }).catch((error) => {
        return res.status(500).json({
            error: (error as Error).message
        });
    });
});

router.get('/get-alerts', authenticateToken, (req, res) => {
    Alerts.findAll().then((alerts) => {
        return res.json(alerts);
    }).catch((error) => {
        return res.status(500).json({
            error: (error as Error).message
        });
    });
});

router.get('/get-mapping', authenticateToken, (req:any, res:any) => {
    // return res.json(CODE_MAPPING);
    Mapping.findOne().then((mapping) => {
        return res.json(mapping);
    }).catch((error) => {
        return res.status(500).json({
            error: (error as Error).message
        });
    });
});

router.get('/get-results', authenticateToken, async (req:any, res:any) => {
    // Get all alerts for the user
    const alerts = await Alerts.findAll();
    if (!alerts) return res.status(404).json({});

    // Get all results for the alerts
    const results = await Promise.all(alerts.map(async (alert) => {
        return {alert, results: await Results.findAll({where: {alert_id: alert.id}})};
    }));

    return res.json(results);
});

router.put('/update-mapping', authenticateToken, (req, res) => {
    Mapping.update(req.body, {where: {id: 1}}).then(() => {
        return res.status(204).json({});
    }).catch((error) => {
        return res.status(500).json({
            error: (error as Error).message
        });
    });
});

router.post('/update-results', authenticateToken, (req, res) => {
    Results.create(req.body).then((results) => {
        return res.status(201).json(results);
    }).catch((error) => {
        return res.status(400).json({
            error: (error as Error).message
        });
    });
});

export default router;