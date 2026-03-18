import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  LayoutDashboard,
  Video,
  FileText,
  MessageCircle,
  Hash,
  Sun,
  Moon,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Dashboard from "@/pages/dashboard";
import VideoLibrary from "@/pages/video-library";
import DocumentLibrary from "@/pages/document-library";
import AskQuestion from "@/pages/ask-question";
import SlackSetup from "@/pages/slack-setup";
import NotFound from "@/pages/not-found";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/videos", label: "Videos", icon: Video },
  { path: "/documents", label: "Documents", icon: FileText },
  { path: "/ask", label: "Ask", icon: MessageCircle },
  { path: "/slack-setup", label: "Slack", icon: Hash },
];

function DaveBotLogo() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      fill="none"
      aria-label="DaveBot logo"
    >
      <rect x="3" y="6" width="26" height="20" rx="4" stroke="currentColor" strokeWidth="2" className="text-primary" />
      <circle cx="12" cy="16" r="2.5" fill="currentColor" className="text-primary" />
      <circle cx="20" cy="16" r="2.5" fill="currentColor" className="text-primary" />
      <path d="M11 22 c2 2 8 2 10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary" />
    </svg>
  );
}

function Sidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="w-56 h-screen flex flex-col border-r bg-sidebar text-sidebar-foreground shrink-0"
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border shrink-0">
        <DaveBotLogo />
        <span className="font-semibold text-sm tracking-tight" data-testid="text-logo">
          DaveBot
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5" data-testid="nav-sidebar">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          data-testid="button-toggle-theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 mr-2" />
          ) : (
            <Moon className="h-4 w-4 mr-2" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </Button>
        <div className="px-3">
          <PerplexityAttribution />
        </div>
      </div>
    </aside>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/videos" component={VideoLibrary} />
            <Route path="/documents" component={DocumentLibrary} />
            <Route path="/ask" component={AskQuestion} />
            <Route path="/slack-setup" component={SlackSetup} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppLayout />
          </Router>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
