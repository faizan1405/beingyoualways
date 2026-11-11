import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// One premium button language for the whole site: thin borders, refined 10px corners,
// a soft left-to-right fill on hover, gentle lift, arrow glide and press feedback
// (motion utilities live in styles.css; admin keeps colour feedback only).
const buttonVariants = cva(
  "btn-motion relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-btn border border-transparent text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary family: botanical green, hairline border, deeper-green sweep + lift
        default: "btn-lift btn-fill border-primary bg-primary text-primary-foreground [--btn-fill:color-mix(in_oklab,var(--primary)_78%,var(--foreground))]",
        lux: "btn-lift btn-fill border-primary bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-[0.16em] [--btn-fill:color-mix(in_oklab,var(--primary)_78%,var(--foreground))]",
        accent: "btn-lift btn-fill border-accent bg-accent text-accent-foreground text-[11px] font-semibold uppercase tracking-[0.16em] [--btn-fill:color-mix(in_oklab,var(--accent)_80%,var(--foreground))]",
        // Secondary family: thin border that deepens + faint tinted sweep
        luxOutline: "btn-rise btn-fill border-primary/35 bg-transparent text-primary text-[11px] font-semibold uppercase tracking-[0.16em] hover:border-primary [--btn-fill:color-mix(in_oklab,var(--primary)_7%,transparent)]",
        // Lightest bordered CTA (e.g. hero "Our story"): neutral hairline, charcoal text, deepens to green
        luxLight: "btn-rise btn-fill border-foreground/20 bg-background text-foreground/85 text-[11px] font-semibold uppercase tracking-[0.16em] hover:border-primary/60 hover:text-primary [--btn-fill:color-mix(in_oklab,var(--primary)_5%,transparent)]",
        outline: "btn-rise btn-fill border-border bg-background text-foreground hover:border-primary/55 [--btn-fill:var(--secondary)]",
        secondary: "btn-fill border-border/70 bg-secondary text-secondary-foreground hover:border-primary/30 [--btn-fill:color-mix(in_oklab,var(--secondary)_82%,var(--primary))]",
        ghost: "hover:bg-secondary hover:text-foreground",
        // Destructive stays visually distinct: solid, no lift or sweep
        destructive: "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Text link: animated underline + arrow nudge
        link: "btn-underline border-0 text-primary",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-11 px-6",
        xl: "h-12 px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** Toggle chips (category filters, concern navigation) — same border language as buttons. */
const chipVariants = cva(
  "btn-motion btn-fill relative inline-flex h-10 shrink-0 items-center justify-center rounded-btn border px-4 text-[11px] font-semibold uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      active: {
        true: "border-primary bg-primary text-primary-foreground",
        false: "border-border text-foreground hover:border-primary/60 hover:text-primary [--btn-fill:color-mix(in_oklab,var(--primary)_6%,transparent)]",
      },
    },
    defaultVariants: { active: false },
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

export { Button, buttonVariants, chipVariants };
