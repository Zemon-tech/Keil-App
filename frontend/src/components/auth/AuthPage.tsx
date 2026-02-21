import { useState } from "react";

import { cn } from "@/lib/utils";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (mode === "signup") {
    return (
      <main className={cn("min-h-screen bg-background fade-in")}> 
        <div className="grid min-h-svh lg:grid-cols-2">
          <div className="flex flex-col gap-4 p-6 md:p-10">
            <div className="flex justify-center gap-2 md:justify-start">
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-md">
                <SignupForm onSwitchToLogin={() => setMode("login")} />
              </div>
            </div>
          </div>
          <div className="bg-muted relative hidden lg:block">
            <img
              src="/placeholder.png"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={cn("flex min-h-screen items-center justify-center bg-background px-4 fade-in")}>
      <div className="w-full max-w-4xl">
        <LoginForm onSwitchToSignup={() => setMode("signup")} />
      </div>
    </main>
  );
}
