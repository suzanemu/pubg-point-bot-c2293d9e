import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import AdminDashboard from "@/components/AdminDashboard";
import PlayerDashboard from "@/components/PlayerDashboard";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "player" | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          checkAuth();
        } else {
          navigate("/auth");
        }
      }
    );

    // Check initial session
    checkAuth();

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUserId(session.user.id);

    // Fetch user session to get role
    const { data: sessionData, error } = await supabase
      .from("sessions")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching session:", error);
      navigate("/auth");
      return;
    }

    if (!sessionData) {
      console.error("No session data found");
      navigate("/auth");
      return;
    }

    setUserRole(sessionData.role);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userId || !userRole) {
    return null;
  }

  if (userRole === "admin") {
    return <AdminDashboard userId={userId} />;
  }

  return <PlayerDashboard userId={userId} />;
};

export default Index;
