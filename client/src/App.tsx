import { Route, Router as WouterRouter, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import { StoreProvider } from "./lib/store";
import Home from "./pages/Home";
import Demo from "./pages/Demo";
import Ops from "./pages/Ops";
import Dept, { Floor } from "./pages/Dept";
import Board from "./pages/Board";
import Accounts from "./pages/Accounts";
import Client from "./pages/Client";
import Comms from "./pages/Comms";
import NotFound from "./pages/NotFound";

// Works both at the site root and under a GitHub Pages subpath.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <WouterRouter base={BASE}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/demo" component={Demo} />
            <Route path="/ops" component={Ops} />
            <Route path="/floor" component={Floor} />
            <Route path="/floor/:id" component={Dept} />
            <Route path="/board" component={Board} />
            <Route path="/accounts" component={Accounts} />
            <Route path="/client" component={Client} />
            <Route path="/comms" component={Comms} />
            <Route component={NotFound} />
          </Switch>
        </WouterRouter>
      </StoreProvider>
    </ErrorBoundary>
  );
}
