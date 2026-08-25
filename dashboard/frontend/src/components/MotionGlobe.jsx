import { useRef } from 'react';
import { Activity, ArrowUpRight, Globe2 } from 'lucide-react';

function MotionGlobe() {
  const sceneRef = useRef(null);

  const handlePointerMove = (event) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const bounds = scene.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.style.setProperty('--motion-rotate-y', `${x * 18}deg`);
    scene.style.setProperty('--motion-rotate-x', `${y * -14}deg`);
  };

  const resetTilt = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.style.setProperty('--motion-rotate-y', '0deg');
    scene.style.setProperty('--motion-rotate-x', '0deg');
  };

  return (
    <div
      ref={sceneRef}
      className="motion-globe-shell"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      aria-hidden="true"
    >
      <div className="motion-globe-scene">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="orbit orbit-three" />
        <span className="trade-node node-one"><ArrowUpRight size={11} /></span>
        <span className="trade-node node-two"><Activity size={11} /></span>
        <span className="trade-node node-three" />
        <div className="motion-globe">
          <span className="globe-grid longitude-one" />
          <span className="globe-grid longitude-two" />
          <span className="globe-grid latitude-one" />
          <span className="globe-grid latitude-two" />
          <Globe2 size={31} strokeWidth={1.25} />
        </div>
        <span className="motion-shadow" />
      </div>
      <span className="motion-caption">Live analytical model</span>
    </div>
  );
}

export default MotionGlobe;
