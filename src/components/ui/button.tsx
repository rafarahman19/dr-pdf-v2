import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:opacity-95",
        secondary:
          "bg-muted text-foreground border border-border hover:bg-accent hover:text-accent-foreground",
        outline:
          "border border-border bg-card/80 text-foreground hover:bg-accent hover:text-accent-foreground backdrop-blur-sm",
        ghost:
          "text-foreground hover:bg-muted",
        destructive:
          "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:text-white",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-11 px-3.5 py-2 text-xs",
        lg: "min-h-12 px-6 py-3 text-base",
        icon: "min-h-11 min-w-11 p-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
