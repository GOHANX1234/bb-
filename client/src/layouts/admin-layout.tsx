import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  Users,
  Ticket,
  Code,
  Menu,
  X,
  LogOut,
  ChevronRight,
  User,
  Database,
  MessageSquare,
  KeyRound,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    // If window width is between 768px and 1024px, collapse the sidebar
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768 && width < 1024) {
        setIsCollapsed(true);
      } else if (width >= 1024) {
        setIsCollapsed(false);
      }
    };

    // Initial check
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Bottom nav items (mobile only - main 4 items)
  const bottomNavItems = [
    {
      title: "Overview",
      icon: LayoutDashboard,
      href: "/admin",
      active: location === "/admin" || location.startsWith("/admin/resellers/") && location.includes("/keys"),
    },
    {
      title: "Manage Resellers",
      icon: Users,
      href: "/admin/resellers",
      active: location === "/admin/resellers",
    },
    {
      title: "Create Keys",
      icon: KeyRound,
      href: "/admin/create-keys",
      active: location === "/admin/create-keys",
    },
  ];

  // Menu items that go inside the hamburger menu (mobile)
  const menuDrawerItems = [
    {
      title: "Online Updates",
      icon: <MessageSquare className="mr-3 h-5 w-5" />,
      href: "/admin/online-updates",
      active: location === "/admin/online-updates",
    },
    {
      title: "Referral Tokens",
      icon: <Ticket className="mr-3 h-5 w-5" />,
      href: "/admin/tokens",
      active: location === "/admin/tokens",
    },
    {
      title: "Database Backup",
      icon: <Database className="mr-3 h-5 w-5" />,
      href: "/admin/database-backup",
      active: location === "/admin/database-backup",
    },
    {
      title: "API Documentation",
      icon: <Code className="mr-3 h-5 w-5" />,
      href: "/admin/api",
      active: location === "/admin/api",
    },
  ];

  // All nav items for desktop sidebar
  const navItems = [
    {
      title: "Overview",
      icon: <LayoutDashboard className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin",
      active: location === "/admin" || location.startsWith("/admin/resellers/") && location.includes("/keys"),
    },
    {
      title: "Manage Resellers",
      icon: <Users className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin/resellers",
      active: location === "/admin/resellers",
    },
    {
      title: "Create Keys",
      icon: <KeyRound className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin/create-keys",
      active: location === "/admin/create-keys",
    },
    {
      title: "Online Updates",
      icon: <MessageSquare className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin/online-updates",
      active: location === "/admin/online-updates",
    },
    {
      title: "Referral Tokens",
      icon: <Ticket className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin/tokens",
      active: location === "/admin/tokens",
    },
    {
      title: "Database Backup",
      icon: <Database className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin/database-backup",
      active: location === "/admin/database-backup",
    },
    {
      title: "API Documentation",
      icon: <Code className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5`} />,
      href: "/admin/api",
      active: location === "/admin/api",
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header - Different for mobile and desktop */}
      <header className={`sticky top-0 z-40 bg-gradient-to-r from-background via-purple-900/5 to-background backdrop-blur-xl border-b border-purple-500/20 shadow-lg shadow-purple-900/10 flex justify-between items-center ${isMobile ? 'py-4 px-5' : 'py-3 px-6'}`}>
        {isMobile ? (
          // Mobile Top Navbar - Premium Design
          <>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-purple-500/20">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent tracking-tight" data-testid="text-app-name">
                  BB TEAM
                </h1>
                <p className="text-[10px] text-muted-foreground/70 font-medium">License Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 px-3 py-1.5 rounded-full border border-purple-500/30 backdrop-blur-sm shadow-inner flex items-center gap-2">
                <span className="text-[10px] text-purple-400/80 font-bold uppercase tracking-wider" data-testid="badge-admin-role">
                  Admin
                </span>
                <div className="w-px h-3 bg-purple-500/30"></div>
                <span className="text-[10px] text-purple-400/80 font-bold uppercase tracking-wider" data-testid="text-user-title">
                  God
                </span>
              </div>
            </div>
          </>
        ) : (
          // Desktop Header - Premium design with crown
          <>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-purple-500/20">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-purple-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent tracking-tight" data-testid="text-app-name">
                  BB TEAM
                </h1>
                <p className="text-[10px] text-muted-foreground/70 font-medium">License Management</p>
              </div>
              <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 text-xs rounded-md border border-purple-500/20" data-testid="badge-admin-role">
                Admin
              </span>
            </div>
            
            {/* User section - Desktop only */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center gap-2 pr-2 rounded-full bg-purple-900/5 border border-purple-500/10">
                <Avatar className="h-8 w-8 border border-purple-500/20 bg-purple-900/20">
                  <AvatarFallback className="text-purple-400 bg-purple-900/20">
                    {user?.username?.charAt(0)?.toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium" data-testid="text-username">{user?.username}</span>
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="rounded-full bg-background/80 border-red-500/20 hover:bg-red-900/10 hover:text-red-400"
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Logout</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar for larger screens */}
        <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-background/80 border-r border-border hidden md:block transition-all duration-300`}>
          <nav className="h-full flex flex-col py-6">
            <div className="flex-1 px-2">
              <div className={`text-xs font-semibold text-muted-foreground ${isCollapsed ? 'sr-only' : 'px-3 pb-2'}`}>
                MAIN NAVIGATION
              </div>
              
              {/* Collapse/Expand Toggle - Moved to top */}
              <div className="px-1 mb-3">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`w-full justify-center border border-border/50 ${isCollapsed ? 'h-9 rounded-md' : 'hidden'}`}
                  onClick={() => setIsCollapsed(false)}
                  data-testid="button-expand-sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  className={`w-full justify-between border border-border/50 ${isCollapsed ? 'hidden' : ''}`}
                  onClick={() => setIsCollapsed(true)}
                  data-testid="button-collapse-sidebar"
                >
                  <span>Collapse</span>
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
              </div>
              
              <ul className="space-y-1.5">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={item.href}>
                            <div
                              className={`flex items-center px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                                item.active
                                  ? "bg-purple-900/30 text-purple-300 font-medium border border-purple-500/20 shadow-sm"
                                  : "text-foreground hover:bg-background/80 hover:text-purple-300"
                              } ${isCollapsed ? 'justify-center' : ''}`}
                              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              {item.icon}
                              {!isCollapsed && item.title}
                              {!isCollapsed && item.active && <ChevronRight className="ml-auto h-4 w-4 text-purple-400" />}
                            </div>
                          </Link>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className={`flex-1 overflow-y-auto px-4 py-6 sm:p-6 ${isMobile ? 'pb-32' : ''}`}>
          {children}
        </main>
      </div>

      {/* Native Bottom Navigation Bar - Mobile Only */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-background/95 backdrop-blur-xl border-t border-purple-500/20 shadow-[0_-4px_16px_rgba(139,92,246,0.15)]" data-testid="nav-bottom-mobile">
          <div className="safe-bottom">
            <div className="flex items-center justify-around h-16 px-4">
              {bottomNavItems.map((item) => {
                const Icon = item.icon;
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
              
              {/* Menu Item - Opens Modern Drawer */}
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
                  data-testid="sheet-menu-drawer"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                    <SheetDescription>Access additional admin options and settings</SheetDescription>
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
                                {user?.username?.charAt(0)?.toUpperCase() || 'A'}
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
                              Administrator
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Compact Navigation Menu */}
                    <nav className="flex-1 py-4 px-3 overflow-y-auto">
                      <div className="text-[9px] font-bold text-purple-400/60 px-2 pb-3 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-4 h-px bg-gradient-to-r from-purple-500/50 to-transparent"></div>
                        More Options
                      </div>
                      <ul className="space-y-1.5">
                        {menuDrawerItems.map((item, index) => (
                          <li key={item.href} style={{ animationDelay: `${index * 50}ms` }} className="animate-in fade-in slide-in-from-right-4">
                            <Link href={item.href}>
                              <div
                                className={`group flex items-center px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all duration-300 ${
                                  item.active
                                    ? "bg-gradient-to-r from-purple-900/40 to-indigo-900/30 text-purple-300 font-semibold border border-purple-500/30 shadow-lg shadow-purple-500/10 scale-[1.02]"
                                    : "text-foreground hover:bg-gradient-to-r hover:from-purple-900/20 hover:to-transparent hover:text-purple-300 hover:scale-[1.02] hover:shadow-md"
                                }`}
                                onClick={() => {
                                  setMobileMenuOpen(false);
                                }}
                                data-testid={`menu-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                              >
                                <div className={`transition-transform duration-300 ${item.active ? '' : 'group-hover:scale-110'}`}>
                                  {item.icon}
                                </div>
                                <span className="flex-1">{item.title}</span>
                                {item.active ? (
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1" />
                                )}
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
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
      )}
    </div>
  );
}
