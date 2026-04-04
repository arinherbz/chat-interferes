import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Fingerprint, FaceIcon, Smartphone, Trash2, Plus, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { 
  isWebAuthnSupported, 
  isBiometricAvailable, 
  getBiometricType, 
  registerBiometric,
  getBiometricCredentials,
  removeBiometricCredential,
  type WebAuthnCredential
} from "@/lib/webauthn";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function BiometricSettings() {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState("Biometric");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supported = isWebAuthnSupported();
      setIsSupported(supported);
      setIsSecure(typeof window !== "undefined" ? window.isSecureContext : true);
      
      if (supported) {
        const available = await isBiometricAvailable();
        setIsAvailable(available);
        setBiometricType(getBiometricType());
        
        if (available) {
          loadCredentials();
        }
      }
    };
    
    init();
  }, []);

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      const creds = await getBiometricCredentials();
      setCredentials(creds);
    } catch (error) {
      console.error("Failed to load credentials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    setIsRegistering(true);
    try {
      const result = await registerBiometric();
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        await loadCredentials();
      } else {
        toast({
          title: "Setup Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemove = async (credentialId: string) => {
    const success = await removeBiometricCredential(credentialId);
    if (success) {
      toast({
        title: "Removed",
        description: "Biometric authentication removed from this device",
      });
      await loadCredentials();
    } else {
      toast({
        title: "Error",
        description: "Failed to remove biometric credential",
        variant: "destructive",
      });
    }
  };

  // Get appropriate icon
  const BiometricIcon = ({ className }: { className?: string }) => {
    if (biometricType === "Face ID") return <FaceIcon className={className} />;
    if (biometricType === "Fingerprint") return <Fingerprint className={className} />;
    return <Smartphone className={className} />;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Not supported state
  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5" />
            Biometric Authentication
          </CardTitle>
          <CardDescription>
            Your browser doesn't support biometric authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please use a modern browser like Safari (iOS/Mac), Chrome (Android), or Edge to enable Face ID or fingerprint login.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Not available state
  if (!isAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BiometricIcon className="w-5 h-5" />
            {biometricType} Not Available
          </CardTitle>
          <CardDescription>
            This device doesn't have biometric authentication set up
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              To use {biometricType}, you need to set it up in your device settings first:
              <ul className="list-disc ml-5 mt-2">
                <li><strong>iPhone/iPad:</strong> Settings → Face ID & Passcode</li>
                <li><strong>Android:</strong> Settings → Security → Fingerprint</li>
                <li><strong>Mac:</strong> System Preferences → Touch ID</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Not secure context
  if (!isSecure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            HTTPS Required
          </CardTitle>
          <CardDescription>
            Biometric authentication requires a secure connection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You're accessing this site over HTTP. Biometric authentication requires HTTPS.
              <br /><br />
              For local development:
              <code className="block mt-2 p-2 bg-slate-100 rounded text-sm">
                npm install -g local-ssl-proxy<br/>
                local-ssl-proxy --source 5001 --target 5000
              </code>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BiometricIcon className="w-5 h-5" />
          {biometricType} Authentication
        </CardTitle>
        <CardDescription>
          Sign in quickly and securely using your {biometricType.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Registered devices */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : credentials.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-700">Registered Devices</h4>
            {credentials.map((cred) => (
              <div 
                key={cred.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-full shadow-sm">
                    <BiometricIcon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {cred.deviceType === "faceId" ? "Face ID" : 
                       cred.deviceType === "touchId" ? "Touch ID" : 
                       cred.deviceType === "androidBiometric" ? "Fingerprint" : 
                       "Biometric"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Added {formatDate(cred.createdAt)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(cred.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed">
            <BiometricIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-600">No {biometricType.toLowerCase()} set up yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Enable {biometricType.toLowerCase()} for faster, more secure login
            </p>
          </div>
        )}

        {/* Add button */}
        <Button
          onClick={handleEnable}
          disabled={isRegistering}
          className="w-full"
          variant={credentials.length > 0 ? "outline" : "default"}
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              {credentials.length > 0 ? `Add Another ${biometricType}` : `Enable ${biometricType}`}
            </>
          )}
        </Button>

        {/* Security note */}
        <p className="text-xs text-slate-500 text-center">
          Your biometric data never leaves this device. It's stored securely in your device's hardware.
        </p>
      </CardContent>
    </Card>
  );
}
