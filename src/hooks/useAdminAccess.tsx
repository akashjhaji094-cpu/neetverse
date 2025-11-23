import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export const useAdminAccess = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (authLoading) return;

      if (!user) {
        toast.error("You must be logged in to access this page");
        navigate("/auth");
        return;
      }

      try {
        // Check if user has superadmin or content_admin role
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["superadmin", "content_admin"]);

        if (error) {
          console.error("Error checking admin access:", error);
          toast.error("Error checking permissions");
          setIsAdmin(false);
          navigate("/");
          return;
        }

        if (!roles || roles.length === 0) {
          toast.error("Access denied. Admin privileges required.");
          setIsAdmin(false);
          navigate("/");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error("Error in admin access check:", error);
        toast.error("Error checking permissions");
        setIsAdmin(false);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [user, authLoading, navigate]);

  return { isAdmin, loading };
};
