import "./App.css";
import LandingPage from "./pages/LandingPage";
import ContentGeneration from "./pages/ContentGeneration";
import { usePathname } from "./router";

function App() {
  const pathname = usePathname();

  if (pathname === "/check-in") {
    return <ContentGeneration />;
  }

  return <LandingPage />;
}

export default App;
