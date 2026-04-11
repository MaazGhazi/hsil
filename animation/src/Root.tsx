import { Composition } from 'remotion'
import { MLPipeline } from './compositions/MLPipeline'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MLPipeline"
      component={MLPipeline}
      durationInFrames={1200}
      fps={30}
      width={1920}
      height={1080}
    />
  )
}
