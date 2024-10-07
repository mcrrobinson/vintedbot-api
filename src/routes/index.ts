import User from '../models/user.model';
import Session from '../models/sessions.model';
import Alerts from '../models/alerts.model';
import Results from '../models/results.model';
import Mapping from '../models/mapping.model';
import { Router } from 'express';
import express from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { authenticateToken, generateAccessToken, generateRefreshToken, getAccessToken, getUserFromAccessToken, REFRESH_TOKEN_SECRET } from './helper';
import { SmallIntegerDataType } from 'sequelize';
const jobManager = require('./jobManager');

dotenv.config();
const router = Router();

const notificationFreqToCron = (notificationFrequency: number) => {
    switch (notificationFrequency) {
        case 0: // 5 minutes
            return '*/5 * * * *';
        case 1: // 10 minutes
            return '*/10 * * * *';
        case 2: // 30 minutes
            return '*/30 * * * *';
        case 3: // 1 hour
            return  '0 * * * *';
        case 4: // 1 day
            return '0 0 * * *';
        default:
            throw new Error('Invalid notification frequency');
    }
}

Alerts.findAll().then((alerts) => {
    alerts.forEach((result) => {
        console.log(`Found existing alert with ID ${result.id}, scheduling...`);
        jobManager.scheduleJob(result.id, notificationFreqToCron(result.notification_frequency), () => {
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


router.post('/password-update', authenticateToken, async (req: any, res: any) => {
    const user = await User.findOne({where: {id: req.user.id}});
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

        const user = await User.create({name,email,password,created_at: new Date(), admin:false});
        
        const refreshToken = await generateRefreshToken(user.id, email);
        const accessToken = await generateAccessToken(user.id, email);

        return res.status(201).json({
            accessToken,
            refreshToken,
            admin: user.admin
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

    await new Promise((resolve, reject) => {
        jwt.verify(token, REFRESH_TOKEN_SECRET, (err: any, decoded: any) => {
            if (err) return reject(err);
            resolve(decoded);
        });
    });

    // Generate new access token
    const accessToken = await generateAccessToken(user.id, user.email);

    return res.json({ accessToken });

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
        
        const accessToken = await generateAccessToken(user.id, user.email);
        const refreshToken = await generateRefreshToken(user.id, user.email);

        return res.json({ accessToken, refreshToken, admin: user.admin });
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
    notificationFrequency: number;
}

const validateNotificationFrequency = (notificationFrequency: number) =>{

    // We are currently allowing 30 minutes, 1 hour and 1 day. 
    return notificationFrequency >= 2 && notificationFrequency <= 4;
}

router.post('/create-alert', authenticateToken, async (req:any, res:any) => {
    const alert: CreateAlert = req.body;
    console.log('Alert:', alert);

    if(!validateNotificationFrequency(alert.notificationFrequency)) {
        return res.status(400).json({error: 'Invalid notification frequency'});
    }

    const accessToken = await getAccessToken(req);
    if(!accessToken) return res.status(401).json({});

    const user = await getUserFromAccessToken(accessToken);
    if(!user) return res.status(403).json({});

    const alertCount = await Alerts.count({where: {user_id: user.id}});
    if (alertCount >= 5) return res.status(400).json({error: 'Too many alerts'});


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
        colour: [],
        category_friendly: '',
        brand_friendly: [],
        condition_friendly: [],
        // Add any other required properties here
    }).then((alert) => {

        try {
            jobManager.scheduleJob(alert.id, notificationFreqToCron(alert.notification_frequency), () => {

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

router.delete('/delete-alert', authenticateToken, (req:any, res) => {
    Alerts.destroy({where: {id: req.body.id, user_id: req.user.id}}).then(() => {
        jobManager.cancelJob(req.body.id);
        return res.status(200).json({});
    }).catch((error) => {
        return res.status(500).json({
            error: (error as Error).message
        });
    });
});

router.get('/get-alerts', authenticateToken, (req:any, res) => {
    Alerts.findAll({
        where: {user_id: req.user.id}
    }
    ).then((alerts) => {
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
    const alerts = await Alerts.findAll({where: {user_id: req.user.id}});
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