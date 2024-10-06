import { Router } from 'express';
import User from '../models/user.model'
import Alerts from '../models/alerts.model';
import Session from '../models/sessions.model';
import Results from '../models/results.model';
import { authenticateAdmin } from './helper';
const router = Router();

// Middleware
router.use(function(req, res, next) {
    try {
        decodeURIComponent(req.path)
    } catch (e) {
        console.log(new Date().toLocaleString(), req.url, e);
        return res.redirect('/404');
    }
    next();
});

// Routes
router.get('/get-users', authenticateAdmin, async (req, res) => {
    try {
        const users = await User.findAll();
        res.json(users);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/toggle-admin/:id", authenticateAdmin, async (req, res) => {
    // Get the admin bool from body
    const { admin } = req.body;

    try {
        const user = await User.findByPk(req.params.id);
        if (user) {
            user.admin = admin;
            await user.save();
            res.json({ message: "User is now an admin" });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/delete-alert/:id", authenticateAdmin, async (req, res) => {
    try {
        const alert = await Alerts.findByPk(req.params.id);
        if (alert) {
            await alert.destroy();
            res.json({ message: "Alert deleted" });
        } else {
            res.status(404).json({ error: "Alert not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete("/delete-user/:id", authenticateAdmin, async (req:any, res:any) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {

            // Delete all corresponding sessions;
            await Session.destroy({
                where: {
                    user_id: user.id
                }
            });

            // Delete all corresponding alerts;
            const alerts = await Alerts.findAll({
                where: {
                    user_id: user.id
                }
            });
            for (const alert of alerts) {
                await Results.destroy({
                    where: {
                        alert_id: alert.id
                    }
                });
            }
            await Alerts.destroy({
                where: {
                    user_id: user.id
                }
            });
            

            await user.destroy();
            return res.json({ message: "User deleted" });

        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
}

);

router.post("/create-user", authenticateAdmin, async (req, res) => {
    try {
        const user = await User.create(req.body);
        res.json(user);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/update-password/:id", authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {
            user.password = req.body.password;
            await user.save();
            res.json({ message: "Password updated" });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/update-email/:id", authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {
            user.email = req.body.email;
            await user.save();
            res.json({ message: "Email updated" });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.post("/update-name/:id", authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {
            user.name = req.body.name;
            await user.save();
            res.json({ message: "Name updated" });
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/get-alerts/:id", authenticateAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user) {

            const alerts = Alerts.findAll({
                where: {
                    user_id: user.id
                }
            });

            res.json(alerts);
        } else {
            res.status(404).json({ error: "User not found" });
        }
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/get-alerts", authenticateAdmin, async (req, res) => {
    try {
        const alerts = await Alerts.findAll();
        console.log(alerts);
        res.json(alerts);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;