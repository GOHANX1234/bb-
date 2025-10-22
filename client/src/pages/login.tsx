import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, UserCheck, Eye } from "lucide-react";

// Audio utility function for login errors
const playLoginErrorSound = () => {
  try {
    const audio = new Audio('/sounds/login-error.mp3');
    audio.volume = 0.7;
    audio.play().catch(error => console.log('Audio play failed:', error));
  } catch (error) {
    console.log('Audio creation failed:', error);
  }
};

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [activeTab, setActiveTab] = useState<"admin" | "reseller">("admin");
  const { login, isLoginLoading } = useAuth();
  const { toast } = useToast();

  const adminForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const resellerForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onAdminSubmit(values: LoginValues) {
    try {
      await login("admin", values.username, values.password);
      toast({
        title: "Success",
        description: "Logged in as admin successfully",
      });
    } catch (error: any) {
      console.log('Caught error in onAdminSubmit:', error);
      console.log('Error message for toast:', error.message);
      
      // Play login error sound
      playLoginErrorSound();
      
      // Add alert as backup to test visibility
      alert("LOGIN ERROR: " + (error.message || "Failed to login"));
      
      toast({
        title: "Login Failed",
        description: error.message || "Failed to login",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
      console.log('Toast function called with description:', error.message || "Failed to login");
    }
  }

  async function onResellerSubmit(values: LoginValues) {
    try {
      await login("reseller", values.username, values.password);
      toast({
        title: "Success",
        description: "Logged in as reseller successfully",
      });
    } catch (error: any) {
      console.log('Caught error in onResellerSubmit:', error);
      console.log('Error message for toast:', error.message);
      
      // Play login error sound
      playLoginErrorSound();
      
      // Add alert as backup to test visibility
      alert("LOGIN ERROR: " + (error.message || "Failed to login"));
      
      toast({
        title: "Login Failed", 
        description: error.message || "Failed to login",
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
      console.log('Toast function called with description:', error.message || "Failed to login");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 bg-gradient-to-br from-background via-background to-purple-950/20 moving-glow">
      <a 
        href="https://t.me/Gohan52" 
        target="_blank" 
        rel="noopener noreferrer"
        className="block text-center mb-4 text-green-500 hover:text-green-400 transition-colors text-[8px]"
        data-testid="link-telegram-text"
      >
        悟飯
      </a>
      <Card className="max-w-sm w-full border border-purple-500/30 shadow-xl shadow-purple-500/10 backdrop-blur-sm bg-background/80 form-border-glow relative z-10">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="relative" data-testid="icon-sharingan-login">
                <Eye className="text-purple-500 h-5 w-5" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-primary bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text text-transparent pb-1 matrix-font">BB TEAM</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">Professional License Management</p>
          </div>

          <Tabs defaultValue="admin" onValueChange={(value) => setActiveTab(value as "admin" | "reseller")}>
            <div className="flex justify-center mb-4">
              <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-background/80 p-1 border border-purple-500/20">
                <TabsTrigger 
                  value="admin" 
                  className="data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-300 data-[state=active]:shadow-none px-4 py-1.5 text-sm font-medium"
                >
                  Admin
                </TabsTrigger>
                <TabsTrigger 
                  value="reseller" 
                  className="data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-300 data-[state=active]:shadow-none px-4 py-1.5 text-sm font-medium"
                >
                  Reseller
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="admin">
              <Form {...adminForm}>
                <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <UserCheck className="absolute left-3 top-2.5 h-5 w-5 text-purple-400 z-10" aria-hidden="true" />
                            <Input 
                              placeholder="Enter admin username" 
                              className="pl-10" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-5 w-5 text-purple-400 z-10" aria-hidden="true" />
                            <Input 
                              type="password" 
                              placeholder="Enter admin password" 
                              className="pl-10" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 relative" 
                    disabled={isLoginLoading}
                    data-testid="button-admin-login"
                  >
                    {isLoginLoading ? "Logging in..." : "Login as Admin"}
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="reseller">
              <Form {...resellerForm}>
                <form onSubmit={resellerForm.handleSubmit(onResellerSubmit)} className="space-y-4">
                  <FormField
                    control={resellerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <UserCheck className="absolute left-3 top-2.5 h-5 w-5 text-purple-400 z-10" aria-hidden="true" />
                            <Input 
                              placeholder="Enter reseller username" 
                              className="pl-10" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={resellerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-5 w-5 text-purple-400 z-10" aria-hidden="true" />
                            <Input 
                              type="password" 
                              placeholder="Enter reseller password" 
                              className="pl-10" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 relative" 
                    disabled={isLoginLoading}
                    data-testid="button-reseller-login"
                  >
                    {isLoginLoading ? "Logging in..." : "Login as Reseller"}
                  </Button>
                </form>
              </Form>

              <div className="text-center mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">Don't have an account?</p>
                <Button 
                  variant="link" 
                  className="mt-1 text-purple-400 hover:text-purple-300 glow-text"
                  onClick={() => window.location.href = "/register"}
                >
                  Register with Referral Token
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
