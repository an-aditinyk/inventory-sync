import { Route, Switch } from "wouter";
import { Dashboard } from "./pages/Dashboard";
import { NewSync } from "./pages/NewSync";
import { History } from "./pages/History";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/not-found";

export function App() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new-sync" component={NewSync} />
      <Route path="/history" component={History} />
      <Route path="/logs" component={Logs} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}
