import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        // Campaign variants
        campaignBlue1:
          "border-transparent bg-campaign-blue1 text-white shadow hover:bg-campaign-blue1/90",
        campaignBlue2:
          "border-transparent bg-campaign-blue2 text-white shadow hover:bg-campaign-blue2/90",
        campaignRed:
          "border-transparent bg-campaign-red text-white shadow hover:bg-campaign-red/90",
        campaignGold:
          "border-transparent bg-campaign-gold text-black shadow hover:bg-campaign-gold/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants };
