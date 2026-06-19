
"use client";

import * as React from "react";
import { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
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
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setLoading(true);
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        
        // Create Firestore profile
        await createUserProfile(db, {
          uid: userCredential.user.uid,
          email: email,
          displayName: name,
          role: 'staff' // Default role for new signups
        });
        
        toast({ title: "Account Created", description: "Welcome to Cylindera!" });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Logged In", description: "Welcome back!" });
      }
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
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
        <span className="font-headline text-2xl font-bold text-primary">Cylindera</span>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-card relative z-10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-headline font-bold">
            {isRegistering ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {isRegistering 
              ? "Enter your details to register as staff" 
              : "Enter your credentials to access your ledger"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  placeholder="Ram Bahadur" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
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
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full h-12 font-bold" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isRegistering ? "Register" : "Login"}
            </Button>
            
            <div className="w-full text-center">
               <Button 
                variant="link" 
                type="button"
                className="text-muted-foreground text-xs"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? "Already have an account? Login" : "Don't have an account? Create one"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
