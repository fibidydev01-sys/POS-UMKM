import * as React from "react";
import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className
      )}
      {...props}
    />
  );
}
Empty.displayName = "Empty";

function EmptyMedia({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid size-16 place-items-center rounded-2xl bg-secondary text-3xl text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
EmptyMedia.displayName = "EmptyMedia";

function EmptyTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-bold text-foreground", className)} {...props} />;
}
EmptyTitle.displayName = "EmptyTitle";

function EmptyDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("max-w-xs text-sm text-muted-foreground", className)} {...props} />
  );
}
EmptyDescription.displayName = "EmptyDescription";

function EmptyContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-2 flex flex-col gap-2", className)} {...props} />;
}
EmptyContent.displayName = "EmptyContent";

export { Empty, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent };
