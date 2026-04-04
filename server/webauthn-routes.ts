import type { Express, Request, Response } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { db, pool } from "./db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

// In-memory challenge storage (use Redis in production)
const webauthnChallenges = new Map<string, string>();

// RP Configuration - adjust for production
const rpName = "Ariostore";
const rpID = process.env.RP_ID || "localhost";
const origin = process.env.ORIGIN || "http://localhost:5000";

// Types for credentials
interface WebAuthnCredential {
  id: string;
  userId: string;
  credentialID: string;
  credentialPublicKey: Uint8Array;
  counter: number;
  deviceType: string;
  transports: AuthenticatorTransportFuture[];
  createdAt: Date;
}

// Ensure table exists (for SQLite fallback)
async function ensureWebAuthnTable() {
  if (pool) {
    // PostgreSQL - table created via migrations/schema
    return;
  }
  // SQLite fallback
  try {
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        credential_id TEXT NOT NULL,
        credential_public_key TEXT NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        device_type TEXT,
        transports TEXT,
        created_at TEXT
      )
    `);
  } catch (error) {
    console.error("Failed to create webauthn_credentials table:", error);
  }
}

// Storage helpers
async function saveCredential(cred: Omit<WebAuthnCredential, "id">): Promise<string> {
  const id = crypto.randomUUID();
  
  if (pool) {
    await db.execute(sql`
      INSERT INTO webauthn_credentials 
      (id, user_id, credential_id, credential_public_key, counter, device_type, transports, created_at)
      VALUES (
        ${id},
        ${cred.userId},
        ${cred.credentialID},
        ${Buffer.from(cred.credentialPublicKey).toString("base64")},
        ${cred.counter},
        ${cred.deviceType},
        ${JSON.stringify(cred.transports)},
        ${new Date().toISOString()}
      )
    `);
  } else {
    await db.run(sql`
      INSERT INTO webauthn_credentials 
      (id, user_id, credential_id, credential_public_key, counter, device_type, transports, created_at)
      VALUES (
        ${id},
        ${cred.userId},
        ${cred.credentialID},
        ${Buffer.from(cred.credentialPublicKey).toString("base64")},
        ${cred.counter},
        ${cred.deviceType},
        ${JSON.stringify(cred.transports)},
        ${new Date().toISOString()}
      )
    `);
  }
  
  return id;
}

async function getCredentialsByUser(userId: string): Promise<WebAuthnCredential[]> {
  let rows: any[];
  
  if (pool) {
    const result = await db.execute(sql`
      SELECT * FROM webauthn_credentials WHERE user_id = ${userId}
    `);
    rows = result.rows || [];
  } else {
    rows = await db.all(sql`
      SELECT * FROM webauthn_credentials WHERE user_id = ${userId}
    `);
  }
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    credentialID: row.credential_id,
    credentialPublicKey: new Uint8Array(Buffer.from(row.credential_public_key, "base64")),
    counter: row.counter,
    deviceType: row.device_type,
    transports: JSON.parse(row.transports || "[]"),
    createdAt: new Date(row.created_at),
  }));
}

async function updateCredentialCounter(id: string, counter: number) {
  if (pool) {
    await db.execute(sql`
      UPDATE webauthn_credentials SET counter = ${counter} WHERE id = ${id}
    `);
  } else {
    await db.run(sql`
      UPDATE webauthn_credentials SET counter = ${counter} WHERE id = ${id}
    `);
  }
}

async function deleteCredential(id: string, userId: string) {
  if (pool) {
    await db.execute(sql`
      DELETE FROM webauthn_credentials WHERE id = ${id} AND user_id = ${userId}
    `);
  } else {
    await db.run(sql`
      DELETE FROM webauthn_credentials WHERE id = ${id} AND user_id = ${userId}
    `);
  }
}

// Main function to register routes
export function registerWebAuthnRoutes(app: Express, requireAuth: any, storage: any) {
  // Initialize table
  ensureWebAuthnTable().catch(console.error);

  // GET registration options (for enrolling Face ID/Touch ID)
  app.get("/api/auth/webauthn/register-options", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      
      // Check if user already has credentials
      const existingCreds = await getCredentialsByUser(user.id);
      
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.username,
        userDisplayName: user.name || user.username,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
          authenticatorAttachment: "platform", // Face ID / Touch ID only
        },
        // Exclude existing credentials
        excludeCredentials: existingCreds.map(cred => ({
          id: cred.credentialID,
          transports: cred.transports,
        })),
      });

      // Store challenge
      webauthnChallenges.set(`reg:${user.id}`, options.challenge);
      
      res.json(options);
    } catch (error: any) {
      console.error("WebAuthn register options error:", error);
      res.status(500).json({ message: error.message || "Failed to generate registration options" });
    }
  });

  // POST verify registration
  app.post("/api/auth/webauthn/register-verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const { response } = req.body;
      
      const expectedChallenge = webauthnChallenges.get(`reg:${user.id}`);
      if (!expectedChallenge) {
        return res.status(400).json({ message: "Registration challenge expired. Please try again." });
      }

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;
        
        // Determine device type from user agent
        const userAgent = req.headers["user-agent"] || "";
        let deviceType = "unknown";
        if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
          deviceType = "faceId"; // or touchId for older devices
        } else if (userAgent.includes("Android")) {
          deviceType = "androidBiometric";
        } else if (userAgent.includes("Mac")) {
          deviceType = "touchId";
        }

        // Save credential
        await saveCredential({
          userId: user.id,
          credentialID: credential.id,
          credentialPublicKey: credential.publicKey,
          counter: credential.counter,
          deviceType,
          transports: response.response?.transports || [],
          createdAt: new Date(),
        });
        
        webauthnChallenges.delete(`reg:${user.id}`);
        
        res.json({ 
          verified: true, 
          message: "Biometric authentication enabled successfully" 
        });
      } else {
        res.status(400).json({ verified: false, message: "Registration verification failed" });
      }
    } catch (error: any) {
      console.error("WebAuthn register verify error:", error);
      res.status(400).json({ message: error.message || "Verification failed" });
    }
  });

  // POST authentication options (for logging in with Face ID)
  app.post("/api/auth/webauthn/auth-options", async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }

      const user = await storage.getUserByUsername?.(username) || 
                   (await storage.listUsers?.()).find((u: any) => u.username === username);
      
      if (!user) {
        // Don't reveal if user exists - return empty options
        return res.status(404).json({ message: "User not found" });
      }

      const credentials = await getCredentialsByUser(user.id);
      
      if (credentials.length === 0) {
        return res.status(400).json({ 
          message: "No biometric credentials found. Please log in with password first." 
        });
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: credentials.map(cred => ({
          id: cred.credentialID,
          transports: cred.transports,
        })),
        userVerification: "preferred",
      });

      webauthnChallenges.set(`auth:${user.id}`, options.challenge);
      res.json(options);
    } catch (error: any) {
      console.error("WebAuthn auth options error:", error);
      res.status(500).json({ message: error.message || "Failed to generate authentication options" });
    }
  });

  // POST verify authentication (Face ID login)
  app.post("/api/auth/webauthn/auth-verify", async (req: Request, res: Response) => {
    try {
      const { username, response } = req.body;
      
      const user = await storage.getUserByUsername?.(username) || 
                   (await storage.listUsers?.()).find((u: any) => u.username === username);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const credentials = await getCredentialsByUser(user.id);
      
      // Find the credential that matches the response
      const responseCredentialId = response.id as string;
      const credential = credentials.find(c => 
        c.credentialID === responseCredentialId
      );

      if (!credential) {
        return res.status(400).json({ message: "Credential not recognized" });
      }

      const expectedChallenge = webauthnChallenges.get(`auth:${user.id}`);
      if (!expectedChallenge) {
        return res.status(400).json({ message: "Authentication challenge expired" });
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialID,
          publicKey: credential.credentialPublicKey,
          counter: credential.counter,
          transports: credential.transports,
        },
      });

      if (verification.verified) {
        // Update counter to prevent replay attacks
        await updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
        
        // Clear challenge
        webauthnChallenges.delete(`auth:${user.id}`);
        
        // Create session
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.shopId = user.shopId || null;
        
        // Log the login
        await storage.createActivityLog?.({
          action: "BIOMETRIC_LOGIN",
          entity: "auth",
          entityId: user.id,
          userId: user.id,
          userName: user.name || user.username,
          role: user.role,
          shopId: user.shopId,
        });
        
        // Get preferences
        const preferences = await storage.getUserPreferences?.(user.id);
        
        res.json({ 
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email,
            shopId: user.shopId,
          },
          preferences: preferences || null,
        });
      } else {
        res.status(401).json({ message: "Biometric authentication failed" });
      }
    } catch (error: any) {
      console.error("WebAuthn auth verify error:", error);
      res.status(400).json({ message: error.message || "Authentication verification failed" });
    }
  });

  // DELETE credential (disable Face ID for user)
  app.delete("/api/auth/webauthn/credentials/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const credentialId = req.params.id;
      
      await deleteCredential(credentialId, user.id);
      
      res.json({ message: "Biometric credential removed" });
    } catch (error: any) {
      console.error("Delete credential error:", error);
      res.status(500).json({ message: error.message || "Failed to remove credential" });
    }
  });

  // GET user's biometric credentials
  app.get("/api/auth/webauthn/credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.currentUser!;
      const credentials = await getCredentialsByUser(user.id);
      
      res.json(credentials.map(c => ({
        id: c.id,
        deviceType: c.deviceType,
        createdAt: c.createdAt,
      })));
    } catch (error: any) {
      console.error("Get credentials error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch credentials" });
    }
  });
}
