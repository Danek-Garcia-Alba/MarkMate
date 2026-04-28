import DesktopApp from "./components/desktop/DesktopApp";
import MobileApp from "./components/mobile/MobileApp";
import { useIsMobile } from "./hooks/useIsMobile";

export default function App() {
  const isMobile = useIsMobile();

  return isMobile ? <MobileApp /> : <DesktopApp />;
}
