import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-motion inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary family: colour shift + gentle lift + arrow glide
        default: "btn-lift bg-primary text-primary-foreground shadow hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        lux: "btn-lift rounded-full bg-primary text-primary-foreground tracking-[0.12em] uppercase text-xs font-semibold shadow-soft hover:bg-[color-mix(in_oklab,var(--primary)_86%,var(--foreground))]",
        accent: "btn-lift rounded-full bg-accent text-accent-foreground tracking-[0.12em] uppercase text-xs font-semibold hover:bg-[color-mix(in_oklab,var(--accent)_88%,var(--foreground))]",
        // Secondary family: border deepens + soft tinted fill
        outline:
          "border border-input bg-background shadow-sm hover:border-primary/60 hover:bg-secondary hover:text-foreground",
        luxOutline: "rounded-full border border-primary/45 text-primary tracking-[0.12em] uppercase text-xs font-semibold hover:border-primary hover:bg-primary/[0.07]",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-[color-mix(in_oklab,var(--secondary)_85%,var(--primary))]",
        ghost: "hover:bg-secondary hover:text-foreground",
        // Text link: animated underline + arrow nudge
        link: "btn-underline text-primary",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        xl: "h-12 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
