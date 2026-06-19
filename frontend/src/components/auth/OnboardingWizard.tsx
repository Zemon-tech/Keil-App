import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCreateCheckout, useCreateOrgCheckout, useUserPlan } from "@/hooks/api/useBilling";
import { useAuth } from "@/contexts/AuthContext";
import { useCompleteOnboarding } from "@/hooks/api/useMe";
import { useAppContext } from "@/contexts/AppContext";
import { 
  Zap, 
  Users, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  Github, 
  Mail, 
  FileText, 
  Loader2 
} from "lucide-react";

export function OnboardingWizard() {
  const { signOut, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { organisations, isLoadingOrgs } = useAppContext();
  const [step, setStep] = useState<"plan" | "welcome">(
    searchParams.get("success") === "true" ? "welcome" : "plan"
  );
  
  // Dodo checkout hooks
  const checkoutPro = useCreateCheckout();
  const checkoutTeams = useCreateOrgCheckout();
  const { refetch } = useUserPlan();
  const completeOnboarding = useCompleteOnboarding();
  
  const [selectedPlan, setSelectedPlan] = useState<"trial" | "pro" | "teams">("trial");
  const [seats, setSeats] = useState(5);
  const [loading, setLoading] = useState(false);

  // Trigger plan refetch if success redirect occurred
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      refetch();
    }
  }, [searchParams, refetch]);

  const handlePlanSelect = async () => {
    setLoading(true);
    try {
      if (selectedPlan === "trial") {
        setStep("welcome");
      } else if (selectedPlan === "pro") {
        checkoutPro.mutate();
      } else if (selectedPlan === "teams") {
        const personalOrg = organisations?.find(o => o.is_personal);
        const targetOrgId = personalOrg?.id || user?.id || "";
        checkoutTeams.mutate({ orgId: targetOrgId, seats });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding.mutateAsync();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground overflow-hidden">
      
      {/* Premium Content Box */}
      <div className="relative w-full max-w-4xl h-[85dvh] max-h-[680px] bg-card border border-border rounded-2xl p-8 flex flex-col justify-between shadow-lg overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/5 border border-border flex items-center justify-center">
              <Sparkles className="size-4 text-primary" />
            </div>
            <span className="font-semibold text-base tracking-tight text-foreground">Welcome to KeilHQ</span>
          </div>
          
          <button 
            onClick={signOut}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Sign Out
          </button>
        </div>

        {/* Step Content */}
        <div className="flex-1 flex flex-col justify-center py-6 overflow-hidden">
          
          {step === "plan" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-center max-w-xl mx-auto space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Choose your plan
                </h1>
                <p className="text-muted-foreground text-sm">
                  Select a subscription plan below to unlock your workspace and begin onboarding.
                </p>
              </div>

              {/* Grid of Plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
                
                {/* Plan 1: Pro Trial */}
                <div 
                  onClick={() => setSelectedPlan("trial")}
                  className={`relative p-5 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between h-[250px] ${
                    selectedPlan === "trial" 
                      ? "border-primary bg-accent/20" 
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="p-2 rounded-lg bg-accent flex items-center justify-center">
                        <Zap className="size-4 text-foreground" />
                      </div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                        Free Trial
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">Pro Trial</h3>
                      <p className="text-xs text-muted-foreground mt-1">Unlock all capabilities for 30 days, free of charge.</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <div className="text-lg font-bold text-foreground">$0 <span className="text-xs font-normal text-muted-foreground">/ 30 days</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1">No card required. Starts instantly.</p>
                  </div>
                </div>

                {/* Plan 2: Pro Paid */}
                <div 
                  onClick={() => setSelectedPlan("pro")}
                  className={`relative p-5 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between h-[250px] ${
                    selectedPlan === "pro" 
                      ? "border-primary bg-accent/20" 
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-accent flex items-center justify-center w-fit">
                      <Zap className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">Pro Monthly</h3>
                      <p className="text-xs text-muted-foreground mt-1">Full professional features with no trial boundaries.</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <div className="text-lg font-bold text-foreground">$25 <span className="text-xs font-normal text-muted-foreground">/ month</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1">Checkout via secure Dodo portal.</p>
                  </div>
                </div>

                {/* Plan 3: Teams */}
                <div 
                  onClick={() => setSelectedPlan("teams")}
                  className={`relative p-5 rounded-xl border text-left cursor-pointer transition-all duration-200 flex flex-col justify-between h-[250px] ${
                    selectedPlan === "teams" 
                      ? "border-primary bg-accent/20" 
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="p-2 rounded-lg bg-accent flex items-center justify-center w-fit">
                      <Users className="size-4 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">Teams</h3>
                      <p className="text-xs text-muted-foreground mt-1">Collaborate with multi-seat options.</p>
                    </div>
                    {selectedPlan === "teams" && (
                      <div className="mt-2 flex items-center gap-2 bg-accent/40 px-2 py-1 rounded-lg border border-border w-fit" onClick={(e) => e.stopPropagation()}>
                        <label className="text-[10px] text-muted-foreground">Seats:</label>
                        <input 
                          type="number" 
                          min="1" 
                          max="100"
                          value={seats}
                          onChange={(e) => setSeats(Math.max(1, parseInt(e.target.value) || 1))}
                          className="bg-transparent text-foreground text-xs w-8 text-center outline-none border-b border-border"
                        />
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-border">
                    <div className="text-lg font-bold text-foreground">$25 <span className="text-xs font-normal text-muted-foreground">/ seat / mo</span></div>
                    <p className="text-[10px] text-muted-foreground mt-1">Manage seats dynamically.</p>
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={handlePlanSelect}
                  disabled={loading || checkoutPro.isPending || checkoutTeams.isPending || isLoadingOrgs}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90 transition-all duration-150 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading || checkoutPro.isPending || checkoutTeams.isPending ? (
                    <>
                      <Loader2 className="animate-spin size-4" />
                      Redirecting to payment...
                    </>
                  ) : isLoadingOrgs ? (
                    <>
                      <Loader2 className="animate-spin size-4" />
                      Initializing workspace...
                    </>
                  ) : (
                    <>
                      {selectedPlan === "trial" ? "Start Free Trial" : "Continue to Payment"}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-3xl mx-auto items-center animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Left Column: Welcome & Message */}
              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Configuration completed</span>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Welcome to your new workspace
                  </h1>
                </div>
                
                <p className="text-muted-foreground text-xs leading-relaxed">
                  KeilHQ unifies your team's tasks, notes, direct chat channels, and calendar schedules into a single connected platform.
                </p>

                {/* Clarity Engine Highlight */}
                <div className="p-4 rounded-lg bg-accent/20 border border-border space-y-1">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-foreground" />
                    The Clarity Engine
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Tasks are grounded in predefined objectives and success criteria to avoid ambiguity before execution starts.
                  </p>
                </div>
              </div>

              {/* Right Column: Connect Integrations */}
              <div className="space-y-3 text-left bg-accent/10 border border-border p-4 rounded-xl">
                <h3 className="text-xs font-semibold text-foreground">Integrated Connections</h3>
                <p className="text-[10px] text-muted-foreground">Connect stack accounts directly inside settings afterwards.</p>
                
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  
                  {/* Google Calendar */}
                  <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-accent">
                      <Calendar className="size-3.5 text-foreground" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold text-foreground">Google Calendar</h4>
                      <p className="text-[9px] text-muted-foreground">2-way sync</p>
                    </div>
                  </div>

                  {/* Notion */}
                  <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-accent">
                      <FileText className="size-3.5 text-foreground" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold text-foreground">Notion</h4>
                      <p className="text-[9px] text-muted-foreground">Imports pages</p>
                    </div>
                  </div>

                  {/* GitHub */}
                  <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-accent">
                      <Github className="size-3.5 text-foreground" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold text-foreground">GitHub</h4>
                      <p className="text-[9px] text-muted-foreground">Sprint links</p>
                    </div>
                  </div>

                  {/* Gmail */}
                  <div className="p-3 rounded-lg bg-card border border-border flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-accent">
                      <Mail className="size-3.5 text-foreground" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold text-foreground">Gmail</h4>
                      <p className="text-[9px] text-muted-foreground">Inbox view</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>

        {/* Bottom Footer */}
        <div className="border-t border-border pt-5 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className={`size-1.5 rounded-full ${step === "plan" ? "bg-primary" : "bg-muted"}`} />
            <div className={`size-1.5 rounded-full ${step === "welcome" ? "bg-primary" : "bg-muted"}`} />
          </div>

          {step === "welcome" && (
            <button
              onClick={handleCompleteOnboarding}
              className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-xs font-medium hover:opacity-90 transition-colors active:scale-[0.98]"
            >
              Launch KeilHQ
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
