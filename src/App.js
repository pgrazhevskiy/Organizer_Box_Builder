import React, { useState, useMemo, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import { STLExporter } from "three-stdlib";

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

const initWalls = (gridX, gridY) => {
  const hWalls = Array(Math.max(1, gridY - 1))
    .fill()
    .map(() => Array(Math.max(1, gridX)).fill(true));
  const vWalls = Array(Math.max(1, gridY))
    .fill()
    .map(() => Array(Math.max(1, gridX - 1)).fill(true));
  return { hWalls, vWalls };
};

const createRoundedRectShape = (width, depth, radius) => {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;

  if (radius <= 0) {
    shape.moveTo(x, y);
    shape.lineTo(x + width, y);
    shape.lineTo(x + width, y + depth);
    shape.lineTo(x, y + depth);
    shape.lineTo(x, y);
    return shape;
  }

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + depth - radius);
  shape.absarc(
    x + width - radius,
    y + depth - radius,
    radius,
    0,
    Math.PI / 2,
    false
  );
  shape.lineTo(x + radius, y + depth);
  shape.absarc(
    x + radius,
    y + depth - radius,
    radius,
    Math.PI / 2,
    Math.PI,
    false
  );
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);

  return shape;
};

// ==========================================
// КОМПОНЕНТЫ
// ==========================================

// 1. Компонент экспорта в STL
function Exporter({ trigger }) {
  const { scene } = useThree();

  useEffect(() => {
    if (trigger > 0) {
      const group = scene.getObjectByName("organizer-group");
      if (group) {
        const exporter = new STLExporter();
        const stlString = exporter.parse(group);

        const blob = new Blob([stlString], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.style.display = "none";
        link.href = url;
        link.download = "organizer.stl";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }
  }, [trigger, scene]);

  return null;
}

// 2. Компонент 2D-карты ячеек (Orca Dark Theme)
function CellMap2D({ params, setParams }) {
  const { gridX, gridY, hWalls, vWalls } = params;

  const svgSize = 200;
  const cellW = svgSize / gridX;
  const cellH = svgSize / gridY;

  const toggleHWall = (r, c) => {
    const newH = hWalls.map((row, i) =>
      i === r ? row.map((val, j) => (j === c ? !val : val)) : row
    );
    setParams((p) => ({ ...p, hWalls: newH }));
  };

  const toggleVWall = (r, c) => {
    const newV = vWalls.map((row, i) =>
      i === r ? row.map((val, j) => (j === c ? !val : val)) : row
    );
    setParams((p) => ({ ...p, vWalls: newV }));
  };

  return (
    <div className="mt-3 flex flex-col items-center">
      <p className="text-[10px] text-[#888] mb-2 text-center leading-tight">
        Кликните на линии для объединения
      </p>
      <svg
        width={svgSize}
        height={svgSize}
        className="bg-[#1e1e1e] rounded-sm border border-[#444]"
      >
        {/* Внешняя рамка */}
        <rect
          x="0"
          y="0"
          width={svgSize}
          height={svgSize}
          fill="none"
          stroke="#555"
          strokeWidth="4"
        />

        {hWalls.map((row, r) =>
          row.map((isActive, c) => {
            const y = (r + 1) * cellH;
            const x1 = c * cellW;
            const x2 = (c + 1) * cellW;
            return (
              <g
                key={`h-${r}-${c}`}
                onClick={() => toggleHWall(r, c)}
                className="cursor-pointer group"
              >
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke={isActive ? "#10b981" : "#333"}
                  strokeWidth={isActive ? "2" : "1"}
                  strokeDasharray={isActive ? "none" : "4 4"}
                />
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke="transparent"
                  strokeWidth="16"
                  className="group-hover:stroke-[#10b981]/30 transition-colors"
                />
              </g>
            );
          })
        )}

        {vWalls.map((row, r) =>
          row.map((isActive, c) => {
            const x = (c + 1) * cellW;
            const y1 = r * cellH;
            const y2 = (r + 1) * cellH;
            return (
              <g
                key={`v-${r}-${c}`}
                onClick={() => toggleVWall(r, c)}
                className="cursor-pointer group"
              >
                <line
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke={isActive ? "#10b981" : "#333"}
                  strokeWidth={isActive ? "2" : "1"}
                  strokeDasharray={isActive ? "none" : "4 4"}
                />
                <line
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth="16"
                  className="group-hover:stroke-[#10b981]/30 transition-colors"
                />
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

// 3. Компонент 3D-модели (Серый филамент)
function OrganizerModel({ params }) {
  const { bottomGeo, wallsGeo, innerWallsData } = useMemo(() => {
    const {
      width,
      depth,
      height,
      bottomThickness,
      outerWallLines,
      innerWallLines,
      lineWidth,
      cornerRadius,
      gridX,
      gridY,
      hWalls,
      vWalls,
      dividerHeight,
    } = params;

    const outerWallThickness = outerWallLines * lineWidth;
    const innerWallThickness = innerWallLines * lineWidth;

    const outerShape = createRoundedRectShape(width, depth, cornerRadius);
    const bottomGeometry = new THREE.ExtrudeGeometry(outerShape, {
      depth: bottomThickness,
      bevelEnabled: false,
    });

    const wallsShape = createRoundedRectShape(width, depth, cornerRadius);
    const innerRadius = Math.max(0, cornerRadius - outerWallThickness);
    const innerHole = createRoundedRectShape(
      width - 2 * outerWallThickness,
      depth - 2 * outerWallThickness,
      innerRadius
    );
    wallsShape.holes.push(innerHole);
    const wallsGeometry = new THREE.ExtrudeGeometry(wallsShape, {
      depth: height - bottomThickness,
      bevelEnabled: false,
    });

    const innerWidth = width - 2 * outerWallThickness;
    const innerDepth = depth - 2 * outerWallThickness;

    const totalInnerWallWidth = (gridX - 1) * innerWallThickness;
    const totalInnerWallDepth = (gridY - 1) * innerWallThickness;

    const cellW = (innerWidth - totalInnerWallWidth) / gridX;
    const cellD = (innerDepth - totalInnerWallDepth) / gridY;

    const x0 = -innerWidth / 2;
    const y0 = -innerDepth / 2;
    const zPos = bottomThickness + dividerHeight / 2;

    const innerWalls = [];

    hWalls.forEach((row, r) => {
      row.forEach((isActive, c) => {
        if (isActive) {
          const yCenter =
            y0 +
            (r + 1) * cellD +
            r * innerWallThickness +
            innerWallThickness / 2;
          const cellLeft = x0 + c * (cellW + innerWallThickness);
          const extLeft = c === 0 ? 0 : innerWallThickness / 2;
          const extRight = c === gridX - 1 ? 0 : innerWallThickness / 2;
          const wallWidth = cellW + extLeft + extRight;
          const xCenter = cellLeft - extLeft + wallWidth / 2;

          innerWalls.push({
            position: [xCenter, yCenter, zPos],
            args: [wallWidth, innerWallThickness, dividerHeight],
          });
        }
      });
    });

    vWalls.forEach((row, r) => {
      row.forEach((isActive, c) => {
        if (isActive) {
          const xCenter =
            x0 +
            (c + 1) * cellW +
            c * innerWallThickness +
            innerWallThickness / 2;
          const cellBottom = y0 + r * (cellD + innerWallThickness);
          const extBottom = r === 0 ? 0 : innerWallThickness / 2;
          const extTop = r === gridY - 1 ? 0 : innerWallThickness / 2;
          const wallDepth = cellD + extBottom + extTop;
          const yCenter = cellBottom - extBottom + wallDepth / 2;

          innerWalls.push({
            position: [xCenter, yCenter, zPos],
            args: [innerWallThickness, wallDepth, dividerHeight],
          });
        }
      });
    });

    return {
      bottomGeo: bottomGeometry,
      wallsGeo: wallsGeometry,
      innerWallsData: innerWalls,
    };
  }, [params]);

  // Цвет матового серого филамента
  const filamentMaterial = (
    <meshStandardMaterial color="#9ca3af" roughness={0.6} metalness={0.1} />
  );

  return (
    <group name="organizer-group" rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={bottomGeo}>{filamentMaterial}</mesh>
      <mesh geometry={wallsGeo} position={[0, 0, params.bottomThickness]}>
        {filamentMaterial}
      </mesh>
      {innerWallsData.map((wall, i) => (
        <mesh key={i} position={wall.position}>
          <boxGeometry args={wall.args} />
          {filamentMaterial}
        </mesh>
      ))}
    </group>
  );
}

// 4. Главный компонент приложения
export default function App() {
  const [exportTrigger, setExportTrigger] = useState(0);

  const [params, setParams] = useState({
    lineWidth: 0.42,
    width: 200,
    depth: 200,
    height: 50,
    bottomThickness: 0.8,
    outerWallLines: 3,
    cornerRadius: 5,
    gridX: 2,
    gridY: 2,
    innerWallLines: 2,
    dividerHeight: 49.2,
    ...initWalls(2, 2),
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    let numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) numValue = 0;

    setParams((prev) => {
      const newParams = { ...prev, [name]: numValue };
      const maxDividerHeight = newParams.height - newParams.bottomThickness;
      if (newParams.dividerHeight > maxDividerHeight) {
        newParams.dividerHeight = maxDividerHeight;
      }
      if (name === "gridX" || name === "gridY") {
        const safeX = Math.max(1, Math.floor(newParams.gridX));
        const safeY = Math.max(1, Math.floor(newParams.gridY));
        newParams.gridX = safeX;
        newParams.gridY = safeY;
        const newWalls = initWalls(safeX, safeY);
        newParams.hWalls = newWalls.hWalls;
        newParams.vWalls = newWalls.vWalls;
      }
      return newParams;
    });
  };

  // Ультра-компактный инпут в стиле Orca Slicer
  const InputField = ({ label, name, step = 1, min = 0, max }) => (
    <div className="flex justify-between items-center mb-[2px] hover:bg-[#333] px-1 py-0.5 rounded transition-colors">
      <label className="text-[11px] text-[#cccccc] cursor-pointer select-none">
        {label}
      </label>
      <input
        type="number"
        name={name}
        value={params[name]}
        onChange={handleChange}
        step={step}
        min={min}
        max={max}
        className="w-14 h-5 bg-[#1e1e1e] border border-[#444] rounded-sm text-right text-[11px] text-[#eee] focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all px-1"
      />
    </div>
  );

  return (
    <>
      {/* Стили для темного скроллбара */}
      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #252526; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>

      <div className="flex h-screen w-screen bg-[#1e1e1e] overflow-hidden font-sans select-none">
        {/* ЛЕВАЯ ПАНЕЛЬ (Темная, компактная) */}
        <div className="w-72 bg-[#252526] border-r border-[#3e3e42] z-10 flex flex-col h-full shadow-2xl">
          <div className="p-3 bg-[#2d2d30] border-b border-[#3e3e42] flex-shrink-0">
            <h1 className="text-[13px] font-bold text-[#eee] tracking-wide">
              Органайзер
            </h1>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            <section>
              <h2 className="text-[10px] font-bold text-[#888] mb-1 uppercase tracking-wider px-1">
                Печать
              </h2>
              <InputField
                label="Ширина линии (мм)"
                name="lineWidth"
                step={0.01}
              />
            </section>

            <section>
              <h2 className="text-[10px] font-bold text-[#888] mb-1 uppercase tracking-wider px-1">
                Габариты
              </h2>
              <InputField label="Ширина - X (мм)" name="width" />
              <InputField label="Глубина - Y (мм)" name="depth" />
              <InputField label="Высота - Z (мм)" name="height" />
              <InputField
                label="Толщина дна (мм)"
                name="bottomThickness"
                step={0.1}
              />
              <InputField label="Внеш. стенки (линий)" name="outerWallLines" />
              <InputField label="Скругление (мм)" name="cornerRadius" />
            </section>

            <section>
              <h2 className="text-[10px] font-bold text-[#888] mb-1 uppercase tracking-wider px-1">
                Ячейки
              </h2>
              <InputField label="Кол-во по X (колонок)" name="gridX" />
              <InputField label="Кол-во по Y (строк)" name="gridY" />
              <InputField label="Внутр. стенки (линий)" name="innerWallLines" />
              <InputField
                label="Высота разделителей"
                name="dividerHeight"
                step={0.1}
                max={params.height - params.bottomThickness}
              />

              <CellMap2D params={params} setParams={setParams} />
            </section>
          </div>

          <div className="p-3 border-t border-[#3e3e42] bg-[#252526] flex-shrink-0">
            <button
              onClick={() => setExportTrigger((prev) => prev + 1)}
              className="w-full py-1.5 bg-[#10b981] hover:bg-[#0ea5e9] text-white text-[12px] font-bold rounded-sm transition-colors shadow-sm flex justify-center items-center gap-2"
            >
              Экспорт в STL
            </button>
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ (3D Viewport) */}
        <div className="flex-1 relative bg-[#1a1a1a]">
          <Canvas camera={{ position: [150, 150, 150], fov: 50 }}>
            {/* Темный фон сцены */}
            <color attach="background" args={["#1a1a1a"]} />

            <ambientLight intensity={0.4} />
            <directionalLight
              position={[100, 200, 100]}
              intensity={1.2}
              castShadow
            />
            <Environment preset="city" />
            <OrbitControls makeDefault />

            {/* Темная сетка */}
            <Grid
              infiniteGrid
              fadeDistance={800}
              sectionColor="#444"
              cellColor="#2a2a2a"
            />

            <OrganizerModel params={params} />
            <Exporter trigger={exportTrigger} />
          </Canvas>

          <div className="absolute bottom-4 right-4 bg-[#252526]/80 border border-[#444] px-3 py-1.5 rounded-sm shadow-lg text-[10px] text-[#aaa] pointer-events-none backdrop-blur-sm">
            ЛКМ - вращение | ПКМ - перемещение | Колесико - зум
          </div>
        </div>
      </div>
    </>
  );
}
