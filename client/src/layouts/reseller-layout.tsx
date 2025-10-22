import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import {
  LayoutDashboard,
  Key,
  ListChecks,
  Code,
  Menu,
  X,
  LogOut,
  Crown,
  ChevronRight,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

interface ResellerLayoutProps {
  children: ReactNode;
}

export default function ResellerLayout({ children }: ResellerLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Initialize WebSocket connection for real-time notifications (global for all reseller pages)
  useWebSocket();

  const { data: profile } = useQuery<any>({
    queryKey: ['/api/reseller/profile'],
    enabled: !!user,
  });

  const navItems = [
    {
      title: "Overview",
      icon: <LayoutDashboard className="mr-3 h-5 w-5" />,
      href: "/reseller",
      active: location === "/reseller",
    },
    {
      title: "Generate Keys",
      icon: <Key className="mr-3 h-5 w-5" />,
      href: "/reseller/generate",
      active: location === "/reseller/generate",
    },
    {
      title: "Manage Keys",
      icon: <ListChecks className="mr-3 h-5 w-5" />,
      href: "/reseller/keys",
      active: location === "/reseller/keys",
    },
    // API Reference hidden as requested
    // {
    //   title: "API Reference",
    //   icon: <Code className="mr-3 h-5 w-5" />,
    //   href: "/reseller/api",
    //   active: location === "/reseller/api",
    // },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-black to-black/95">
      {/* Header - Simplified for Mobile */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-background via-purple-900/5 to-background backdrop-blur-xl border-b border-purple-500/20 shadow-lg shadow-purple-900/10 flex justify-between items-center py-4 px-5">
        {/* Left: NIKU MODS + Reseller Tag */}
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-purple-500/20">
            <Crown className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          <div className="flex flex-col">
            {/* Desktop: NIKU MODS with Reseller tag inline */}
            <div className="hidden sm:flex items-center gap-2">
              <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent tracking-tight" data-testid="text-app-name">
                BB TEAM
              </h1>
              <span className="px-2 py-0.5 bg-purple-900/40 text-purple-400 text-[10px] rounded-md border border-purple-500/30 font-semibold" data-testid="badge-reseller-role">
                Reseller
              </span>
            </div>
            {/* Mobile: NIKU MODS with Reseller tag below */}
            <div className="sm:hidden">
              <h1 className="text-base font-black bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent tracking-tight" data-testid="text-app-name">
                BB TEAM
              </h1>
              <p className="text-[9px] text-purple-400/80 font-semibold uppercase tracking-wider" data-testid="badge-reseller-role-mobile">
                Reseller
              </p>
            </div>
            <p className="text-[9px] text-muted-foreground/70 font-medium hidden sm:block">License Management</p>
          </div>
        </div>

        {/* Right: Credits for Mobile, Full info for Desktop */}
        <div className="flex items-center gap-2">
          {/* Mobile: Just show credits with icon */}
          <div className="sm:hidden bg-gradient-to-r from-purple-900/40 to-indigo-900/40 px-3 py-1.5 rounded-full border border-purple-500/30 backdrop-blur-sm shadow-inner flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-purple-300" />
            <span className="text-xs text-purple-300 font-semibold" data-testid="text-credits-mobile">
              {profile?.credits || 0}
            </span>
          </div>
          
          {/* Desktop: Show full info */}
          <div className="hidden sm:flex items-center space-x-3">
            <span className="text-sm text-foreground">{user?.username}</span>
            <span className="text-sm text-purple-400 font-medium bg-purple-900/20 px-3 py-1 rounded-md border border-purple-500/20">
              Credits: <span className="text-white">{profile?.credits || 0}</span>
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-500/10" 
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">

        {/* Sidebar for desktop */}
        <aside className="w-64 bg-black/50 border-r border-purple-900/30 hidden sm:block">
          <div className="bg-purple-900/20 mx-4 mt-6 p-4 rounded-lg border border-purple-500/20">
            <div className="text-sm text-foreground mb-1">Available Credits</div>
            <div className="text-2xl font-bold text-white">{profile?.credits || 0}</div>
          </div>
          
          <nav className="mt-6 px-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div
                      className={`flex items-center px-4 py-3 rounded-md cursor-pointer transition-colors ${
                        item.active
                          ? "bg-purple-900/30 text-purple-300 font-medium border border-purple-500/20"
                          : "text-foreground hover:bg-purple-900/20 hover:text-purple-300"
                      }`}
                    >
                      {item.icon}
                      {item.title}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 sm:pb-6">
          {children}
        </main>
      </div>

      {/* Native Bottom Navigation Bar - Mobile Only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-xl border-t border-purple-500/20 shadow-[0_-4px_16px_rgba(139,92,246,0.15)]" data-testid="nav-bottom-mobile-reseller">
        <div className="safe-bottom">
          <div className="flex items-center justify-around h-16 px-4">
            {/* Main 3 navigation items */}
            {navItems.slice(0, 3).map((item) => {
              const iconMap = {
                'Overview': LayoutDashboard,
                'Generate Keys': Key,
                'Manage Keys': ListChecks,
              };
              const Icon = iconMap[item.title as keyof typeof iconMap];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 ease-out ${
                    item.active 
                      ? 'text-purple-400 scale-105' 
                      : 'text-muted-foreground hover:text-purple-300 hover:scale-105'
                  }`}
                  data-testid={`bottom-nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className={`relative p-2 rounded-2xl transition-all duration-300 ${
                    item.active 
                      ? 'bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/40 shadow-lg shadow-purple-500/20' 
                      : 'hover:bg-purple-900/10'
                  }`}>
                    <Icon className="h-5 w-5" strokeWidth={item.active ? 2.5 : 2} />
                  </div>
                  <span className={`text-[10px] font-semibold transition-all duration-300 ${
                    item.active ? 'text-purple-400' : 'text-muted-foreground'
                  }`}>
                    {item.title.split(' ')[0]}
                  </span>
                </Link>
              );
            })}
            
            {/* Menu Item - Opens Compact Drawer */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300 ease-out ${
                    mobileMenuOpen 
                      ? 'text-purple-400 scale-105' 
                      : 'text-muted-foreground hover:text-purple-300 hover:scale-105'
                  }`}
                  data-testid="bottom-nav-menu"
                >
                  <div className={`relative p-2 rounded-2xl transition-all duration-300 ${
                    mobileMenuOpen 
                      ? 'bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/40 shadow-lg shadow-purple-500/20' 
                      : 'hover:bg-purple-900/10'
                  }`}>
                    {mobileMenuOpen ? (
                      <X className="h-5 w-5" strokeWidth={2.5} />
                    ) : (
                      <Menu className="h-5 w-5" strokeWidth={2} />
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold transition-all duration-300 ${
                    mobileMenuOpen ? 'text-purple-400' : 'text-muted-foreground'
                  }`}>
                    Menu
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent 
                side="right" 
                className="w-[50vw] max-w-[280px] p-0 bg-gradient-to-br from-background via-purple-900/5 to-background backdrop-blur-2xl border-l border-purple-500/30 shadow-2xl"
                data-testid="sheet-menu-drawer-reseller"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>Additional reseller options</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col h-full">
                  {/* Compact User Info Header */}
                  <div className="relative py-5 px-4 border-b border-purple-500/20 bg-gradient-to-br from-purple-900/20 via-indigo-900/10 to-transparent">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl"></div>
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="relative">
                          <Avatar className="h-10 w-10 border-2 border-purple-500/40 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 shadow-xl shadow-purple-500/20">
                            <AvatarFallback className="text-purple-300 bg-gradient-to-br from-purple-900/60 to-indigo-900/60 text-base font-bold">
                              {user?.username?.charAt(0)?.toUpperCase() || 'R'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent truncate" data-testid="text-menu-username">
                            {user?.username}
                          </p>
                          <p className="text-[10px] text-purple-400/80 font-semibold uppercase tracking-wider flex items-center gap-1" data-testid="text-menu-role">
                            <Crown className="h-2.5 w-2.5" />
                            Reseller
                          </p>
                        </div>
                      </div>
                      {/* Credits Display */}
                      <div className="bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-500/20 mt-2">
                        <div className="text-[10px] text-muted-foreground/70 font-medium">Available Credits</div>
                        <div className="text-base font-bold text-purple-300">{profile?.credits || 0}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Compact Navigation Menu - For Future Options */}
                  <nav className="flex-1 py-4 px-3 overflow-y-auto">
                    <div className="text-[9px] font-bold text-purple-400/60 px-2 pb-3 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-4 h-px bg-gradient-to-r from-purple-500/50 to-transparent"></div>
                      More Options
                    </div>
                    {/* Future navigation items will go here */}
                    <div className="text-center py-6 text-xs text-muted-foreground/50">
                      Additional options will appear here
                    </div>
                  </nav>
                  
                  {/* Compact Logout Section */}
                  <div className="p-3 border-t border-purple-500/20 bg-gradient-to-br from-red-900/10 via-transparent to-transparent">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="w-full bg-gradient-to-r from-red-950/60 to-red-900/40 text-red-300 hover:from-red-900/60 hover:to-red-800/50 border border-red-500/30 shadow-lg shadow-red-900/20 font-semibold transition-all duration-300 hover:scale-[1.02] hover:shadow-xl text-xs py-2"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      data-testid="button-menu-logout"
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1.5" /> 
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </div>
  );
}
