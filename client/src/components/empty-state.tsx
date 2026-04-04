import { Package, Users, ShoppingCart, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: "package" | "users" | "cart" | "file" | "search" | "default";
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const icons = {
  package: Package,
  users: Users,
  cart: ShoppingCart,
  file: FileText,
  search: Search,
  default: Package,
};

export function EmptyState({ 
  title, 
  description, 
  icon = "default", 
  action,
  className 
}: EmptyStateProps) {
  const Icon = icons[icon];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
