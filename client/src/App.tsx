import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/lib/themeContext';
import { WindowProvider } from '@/lib/windowContext';
import { OnekoProvider } from '@/lib/onekoContext';
import { ScreensaverProvider } from '@/lib/screensaverContext';
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import "@/lib/cs16.css";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <OnekoProvider>
          <ScreensaverProvider>
            <WindowProvider>
              <div className="app">
                <Router />
                <Toaster />
              </div>
            </WindowProvider>
          </ScreensaverProvider>
        </OnekoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
