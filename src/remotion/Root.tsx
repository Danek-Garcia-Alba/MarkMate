import {Composition} from "remotion";
import {InstallDemo} from "./InstallDemo";
import {MarkMatePromo} from "./MarkMatePromo";

export const RemotionRoot = () => (
  <>
    <Composition
      id="MarkMatePromo"
      component={MarkMatePromo}
      durationInFrames={1440}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="MarkMateInstallDemo"
      component={InstallDemo}
      durationInFrames={330}
      fps={30}
      width={720}
      height={1280}
    />
  </>
);
