import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { apiRequest } from "./api";

export interface WebAuthnCredential {
  id: string;
  deviceType: string;
  createdAt: string;
}

/**
 * Check if browser supports WebAuthn (Face ID / Touch ID)
 */
export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined" && 
         window.PublicKeyCredential !== undefined;
}

/**
 * Check if device has Face ID / Touch ID / Fingerprint available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Get a friendly name for the biometric type based on device
 */
export function getBiometricType(): string {
  if (typeof navigator === "undefined") return "Biometric";
  
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
    // Check if device supports Face ID (iPhone X and later)
    const isFaceIdDevice = /iphone (1[1-9]|[2-9][0-9])/.test(userAgent);
    return isFaceIdDevice ? "Face ID" : "Touch ID";
  }
  
  if (userAgent.includes("macintosh")) {
    return "Touch ID";
  }
  
  if (userAgent.includes("android")) {
    return "Fingerprint";
  }
  
  return "Biometric";
}

/**
 * Register Face ID / Touch ID for current user
 */
export async function registerBiometric(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if supported
    if (!isWebAuthnSupported()) {
      return { success: false, message: "Your browser doesn't support biometric authentication" };
    }

    const isAvailable = await isBiometricAvailable();
    if (!isAvailable) {
      return { success: false, message: "No biometric authenticator found on this device" };
    }

    // Get registration options from server
    const options = await apiRequest("GET", "/api/auth/webauthn/register-options");
    
    // Trigger Face ID / Touch ID prompt
    const attestation = await startRegistration(options);
    
    // Verify with server
    const result = await apiRequest("POST", "/api/auth/webauthn/register-verify", {
      response: attestation,
    });
    
    return { 
      success: result.verified, 
      message: result.message || `${getBiometricType()} enabled successfully!` 
    };
  } catch (error: any) {
    console.error("Biometric registration error:", error);
    
    // Handle specific errors
    if (error.name === "NotAllowedError") {
      return { success: false, message: "Permission denied. Please allow biometric access." };
    }
    if (error.name === "AbortError") {
      return { success: false, message: "Authentication was cancelled." };
    }
    if (error.name === "SecurityError") {
      return { success: false, message: "Biometric authentication requires a secure context (HTTPS)." };
    }
    
    return { 
      success: false, 
      message: error.message || "Failed to enable biometric authentication" 
    };
  }
}

/**
 * Login with Face ID / Touch ID
 */
export async function loginWithBiometric(
  username: string
): Promise<{ success: boolean; user?: any; preferences?: any; message: string }> {
  try {
    if (!isWebAuthnSupported()) {
      return { success: false, message: "Your browser doesn't support biometric authentication" };
    }

    // Get authentication options
    const options = await apiRequest("POST", "/api/auth/webauthn/auth-options", { username });
    
    // Trigger Face ID / Touch ID prompt
    const assertion = await startAuthentication(options);
    
    // Verify with server
    const result = await apiRequest("POST", "/api/auth/webauthn/auth-verify", {
      username,
      response: assertion,
    });
    
    return { 
      success: true, 
      user: result.user,
      preferences: result.preferences,
      message: "Welcome back!" 
    };
  } catch (error: any) {
    console.error("Biometric login error:", error);
    
    if (error.name === "NotAllowedError") {
      return { success: false, message: "Biometric verification failed. Try again." };
    }
    if (error.name === "AbortError") {
      return { success: false, message: "Authentication was cancelled." };
    }
    if (error.status === 404) {
      return { success: false, message: "User not found." };
    }
    if (error.status === 400) {
      return { success: false, message: error.message || "No biometric credentials found." };
    }
    
    return { 
      success: false, 
      message: error.message || "Biometric login failed" 
    };
  }
}

/**
 * Get user's registered biometric credentials
 */
export async function getBiometricCredentials(): Promise<WebAuthnCredential[]> {
  try {
    return await apiRequest("GET", "/api/auth/webauthn/credentials");
  } catch {
    return [];
  }
}

/**
 * Remove a biometric credential
 */
export async function removeBiometricCredential(credentialId: string): Promise<boolean> {
  try {
    await apiRequest("DELETE", `/api/auth/webauthn/credentials/${credentialId}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if running in a secure context (required for WebAuthn)
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext;
}
