import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.HTMLAttributes<SVGSVGElement>) {
  return <Loader2 className={cn("size-4 animate-spin", className)} {...props} />;
}

export { Spinner };
