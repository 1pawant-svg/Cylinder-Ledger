
"use client";

import * as React from "react";
import { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail
} from "firebase/auth";
import { useAuth, useFirestore } from "@/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Flame, Loader2 } from "lucide-react";
import { createUserProfile } from "@/lib/services/user-service";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Ensure profile exists (for users created via console)
      await createUserProfile(db, {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        fullName: userCredential.user.displayName || "User"
      });

      toast({ title: "Logged In", description: "Welcome back to PGS Ledger!" });
      router.push("/");
    } catch (error: any) {
      let message = "Could not sign you in. Please check your credentials.";
      if (error.code === 'auth/user-not-found') message = "Account not found. Please contact your administrator.";
      if (error.code === 'auth/wrong-password') message = "Incorrect password.";
      
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ variant: "destructive", title: "Email Required", description: "Please enter your email address to reset password." });
      return;
    }
    if (!auth) return;

    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Reset Email Sent", description: "Please check your inbox." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl" />

      <div className="absolute top-8 left-8 flex items-center gap-3">
        <div className="bg-primary rounded-lg p-2">
          <Flame className="text-primary-foreground h-6 w-6" />
        </div>
        <span className="font-headline text-2xl font-bold text-primary">PGS Ledger</span>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-card relative z-10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-headline font-bold">
            Welcome back
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your ledger
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button variant="link" type="button" className="px-0 h-auto text-xs" onClick={handleForgotPassword}>
                  Forgot password?
                </Button>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <form-footer className="flex flex-col p-6 pt-0 space-y-4">
            <Button className="w-full h-12 font-bold" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login
            </Button>
            
            <div className="w-full text-center">
               <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold">
                 PGS Cylinder Ledger System
               </p>
            </div>
          </form-footer>
        </form>
      </Card>
    </div>
  );
}
