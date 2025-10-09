import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        // Campaign variants
        campaignBlue1:
          "border-campaign-blue1/50 text-campaign-blue1 bg-campaign-blue1/10 [&>svg]:text-campaign-blue1",
        campaignBlue2:
          "border-campaign-blue2/50 text-campaign-blue2 bg-campaign-blue2/10 [&>svg]:text-campaign-blue2",
        campaignRed:
          "border-campaign-red/50 text-campaign-red bg-campaign-red/10 [&>svg]:text-campaign-red",
        campaignGold:
          "border-campaign-gold/50 text-campaign-gold bg-campaign-gold/10 [&>svg]:text-campaign-gold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props} />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props} />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props} />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertDescription, AlertTitle };
