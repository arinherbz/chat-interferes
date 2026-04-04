import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Fingerprint, FaceIcon, Smartphone, ShieldCheck, Loader2 } from "lucide-react";
import { isWebAuthnSupported, isBiometricAvailable, getBiometricType, loginWithBiometric } from "@/lib/webauthn";
import { cn } from "@/lib/utils";

interface BiometricLoginButtonProps {
  username: string;
  onSuccess: (user: any, preferences?: any) => void;
  className?: string;
}

export function BiometricLoginButton({ username, onSuccess, className }: BiometricLoginButtonProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState("Biometric");

  useEffect(() => {
    const checkAvailability = async () => {
      const supported = isWebAuthnSupported();
      setIsSupported(supported);
      
      if (supported) {
        const available = await isBiometricAvailable();
        setIsAvailable(available);
        setBiometricType(getBiometricType());
      }
    };
    
    checkAvailability();
  }, []);

  // Don't show if not supported
  if (!isSupported) return null;

  const handleBiometricLogin = async () => {
    if (!username.trim()) {
      return; // Let parent handle username validation
    }
    
    setIsLoading(true);
    try {
      const result = await loginWithBiometric(username.trim());
      if (result.success && result.user) {
        onSuccess(result.user, result.preferences);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get appropriate icon
  const BiometricIcon = () => {
    if (biometricType === "Face ID") return <FaceIcon className="w-5 h-5" />;
    if (biometricType === "Fingerprint") return <Fingerprint className="w-5 h-5" />;
    return <Smartphone className="w-5 h-5" />;
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("w-full relative", className)}
      onClick={handleBiometricLogin}
      disabled={isLoading || !username.trim()}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <BiometricIcon />
      )}
      <span className="ml-2">
        {isLoading 
          ? "Verifying..." 
          : isAvailable 
            ? `Sign in with ${biometricType}`
            : `${biometricType} not available on this device`
        }
      </span>
      
      {/* Show checkmark if available */}
      {isAvailable && !isLoading && (
        <ShieldCheck className="w-4 h-4 ml-auto text-green-500" />
      )}
    </Button>
  );
}
