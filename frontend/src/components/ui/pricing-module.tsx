"use client";

import * as React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  users: string;
  features: PlanFeature[];
  recommended?: boolean;
  onSelect?: () => void;
}

export interface PricingModuleProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  annualBillingLabel?: string;
  buttonLabel?: string;
  plans: PricingPlan[];
  defaultAnnual?: boolean;
  className?: string;
  currencyPrefix?: string;
  onPlanClick?: (plan: PricingPlan) => void;
}

export function PricingModule({
  title = "Pricing Plans",
  subtitle = "Choose a plan that fits your needs.",
  annualBillingLabel = "Annual billing",
  buttonLabel = "Get started",
  plans,
  defaultAnnual = false,
  className,
  currencyPrefix = "$",
  onPlanClick,
}: PricingModuleProps) {
  const [isAnnual, setIsAnnual] = React.useState(defaultAnnual);

  return (
    <section
      className={cn(
        "w-full bg-background text-foreground py-20 px-4 md:px-8",
        className
      )}
    >
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl font-bold tracking-tight mb-2">{title}</h2>
        <p className="text-muted-foreground mb-8 text-lg">{subtitle}</p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <Switch
            id="billing-toggle"
            isSelected={isAnnual}
            onChange={(checked) => setIsAnnual(checked)}
          />
          <label
            htmlFor="billing-toggle"
            className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            {annualBillingLabel}
          </label>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                "relative border border-slate-200 dark:border-dark-700 bg-white dark:bg-dark-800 rounded-2xl transition-all hover:shadow-xl hover:border-emerald-500/40 flex flex-col justify-between",
                plan.recommended &&
                  "border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.03] shadow-lg shadow-emerald-500/10"
              )}
            >
              {plan.recommended && (
                <div className="absolute -top-3.5 left-0 right-0 mx-auto w-fit bg-emerald-600 text-white font-bold text-xs px-3.5 py-1 rounded-full shadow-md">
                  Recommended
                </div>
              )}

              <div>
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="flex justify-center mb-3 text-emerald-600">{plan.icon}</div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 min-h-[32px]">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="text-center pb-6">
                  <div className="text-3xl font-black text-slate-950 dark:text-white mb-1 transition-all duration-300">
                    {plan.currency || currencyPrefix}
                    {isAnnual ? plan.priceYearly : plan.priceMonthly}
                  </div>
                  <p className="text-xs font-semibold text-slate-400 mb-6">
                    / {isAnnual ? "year" : "month"}
                  </p>

                  <Button
                    variant={plan.recommended ? "default" : "outline"}
                    className={cn(
                      "w-full mb-6 font-bold rounded-xl",
                      plan.recommended
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                        : "border-slate-200 dark:border-dark-700 hover:bg-slate-50"
                    )}
                    onClick={() => {
                      if (plan.onSelect) plan.onSelect();
                      else if (onPlanClick) onPlanClick(plan);
                    }}
                  >
                    {buttonLabel}
                  </Button>

                  <div className="text-left text-xs space-y-4 pt-2 border-t border-slate-100 dark:border-dark-700">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">Capacity</h4>
                      <p className="text-slate-500 font-medium">✓ {plan.users}</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-2">Highlights</h4>
                      <ul className="space-y-2">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            {f.included ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                            )}
                            <span
                              className={
                                f.included
                                  ? "text-slate-600 dark:text-slate-300 font-medium"
                                  : "text-slate-400 dark:text-slate-500 line-through text-[11px]"
                              }
                            >
                              {f.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default PricingModule;
