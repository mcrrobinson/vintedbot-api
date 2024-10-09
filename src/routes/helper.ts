import Session from "../models/sessions.model";
import User from "../models/user.model";
import jwt from 'jsonwebtoken';
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

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

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'youraccesstokensecret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'yourrefreshtokensecret';


async function generateAccessToken(user_id: number, email: string) {
    return jwt.sign({ id:user_id, email: email }, ACCESS_TOKEN_SECRET, { expiresIn: '1m' });
}

async function generateRefreshToken(user_id: number, email: string) {
    const refreshToken = jwt.sign({ id: user_id, email: email }, REFRESH_TOKEN_SECRET);

    await Session.create({
        user_id: user_id,
        refresh_token: refreshToken
    });

    return refreshToken;
}

async function getSecretValue(secretName:string): Promise<any> {
    try {
        const secretValue = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
  
        if (secretValue.SecretString) {
            return JSON.parse(secretValue.SecretString);
        } else {
            throw new Error(`Secret ${secretName} is not a string`);
        }
    } catch (error) {
        console.error(`Error retrieving secret ${secretName}:`, error);
        throw error;
    }
  }

async function generateEmailToken(email: string) {
    return jwt.sign({ email: email }, ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
}



// Middleware to authenticate token
async function authenticateToken(req: any, res: any, next: any) {
    const token = await getAccessToken(req);

    if (!token) return res.status(401).json({});

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err: any, user: any) => {
        
        // Tell the client they need to refresh the token
        if (err instanceof jwt.TokenExpiredError) return res.status(409).json({});

        // Otherwise tell the client the token is invalid, log them out.
        if (err) return res.status(403).json({});
        req.user = user;
        next();
    });
}

async function authenticateAdmin(req: any, res: any, next: any) {
    const token = await getAccessToken(req);

    if (!token) return res.status(401).json({});

    jwt.verify(token, ACCESS_TOKEN_SECRET, async (err: any, user: any) => {
        if (err) return res.status(403).json({});

        const userFromDb = await User.findOne({ where: { email: user.email } });
        if (!userFromDb || !userFromDb.admin) return res.status(403).json({});

        req.user = user;
        next();
    });
}

export { getAccessToken, getUserFromAccessToken, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, generateAccessToken, generateRefreshToken, authenticateToken, authenticateAdmin, generateEmailToken, getSecretValue };