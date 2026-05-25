import React, { useState, useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

// Инициализация матриц внутренних стенок
const initWalls = (gridX, gridY) => {
  const hWalls = Array(Math.max(1, gridY - 1))
    .fill()
    .map(() => Array(Math.max(1, gridX)).fill(true));
  const vWalls = Array(Math.max(1, gridY))
    .fill()
    .map(() => Array(Math.max(1, gridX - 1)).fill(true));
  return { hWalls, vWalls };
};

// Создание 2D-контура со скругленными углами
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

// 1. Компонент 2D-карты ячеек
function CellMap2D({ params, setParams }) {
  const { gridX, gridY, hWalls, vWalls } = params;

  const svgSize = 280;
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
    <div className="mt-4 flex flex-col items-center">
      <p className="text-xs text-gray-500 mb-2">
        Кликайте на линии, чтобы объединить ячейки
      </p>
      <svg
        width={svgSize}
        height={svgSize}
        className="bg-gray-50 rounded-sm shadow-inner"
      >
        <rect
          x="0"
          y="0"
          width={svgSize}
          height={svgSize}
          fill="none"
          stroke="#3b82f6"
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
                  stroke={isActive ? "#64748b" : "#cbd5e1"}
                  strokeWidth={isActive ? "3" : "1"}
                  strokeDasharray={isActive ? "none" : "4 4"}
                />
                <line
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke="transparent"
                  strokeWidth="16"
                  className="group-hover:stroke-red-400/30 transition-colors"
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
                  stroke={isActive ? "#64748b" : "#cbd5e1"}
                  strokeWidth={isActive ? "3" : "1"}
                  strokeDasharray={isActive ? "none" : "4 4"}
                />
                <line
                  x1={x}
                  y1={y1}
                  x2={x}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth="16"
                  className="group-hover:stroke-red-400/30 transition-colors"
                />
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

// 2. Компонент 3D-модели
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

    // --- Дно ---
    const outerShape = createRoundedRectShape(width, depth, cornerRadius);
    const bottomGeometry = new THREE.ExtrudeGeometry(outerShape, {
      depth: bottomThickness,
      bevelEnabled: false,
    });

    // --- Внешние стенки ---
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

    // --- Внутренние стенки (Ячейки) ---
    const innerWidth = width - 2 * outerWallThickness;
    const innerDepth = depth - 2 * outerWallThickness;
    const cellW = innerWidth / gridX;
    const cellD = innerDepth / gridY;
    const zPos = bottomThickness + dividerHeight / 2;

    const innerWalls = [];

    // Горизонтальные разделители
    hWalls.forEach((row, r) => {
      row.forEach((isActive, c) => {
        if (isActive) {
          innerWalls.push({
            position: [
              -innerWidth / 2 + c * cellW + cellW / 2,
              -innerDepth / 2 + (r + 1) * cellD,
              zPos,
            ],
            args: [
              cellW + innerWallThickness,
              innerWallThickness,
              dividerHeight,
            ],
          });
        }
      });
    });

    // Вертикальные разделители
    vWalls.forEach((row, r) => {
      row.forEach((isActive, c) => {
        if (isActive) {
          innerWalls.push({
            position: [
              -innerWidth / 2 + (c + 1) * cellW,
              -innerDepth / 2 + r * cellD + cellD / 2,
              zPos,
            ],
            args: [
              innerWallThickness,
              cellD + innerWallThickness,
              dividerHeight,
            ],
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

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={bottomGeo}>
        <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
      </mesh>
      <mesh geometry={wallsGeo} position={[0, 0, params.bottomThickness]}>
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>

      {/* Рендер внутренних стенок */}
      {innerWallsData.map((wall, i) => (
        <mesh key={i} position={wall.position}>
          <boxGeometry args={wall.args} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// 3. Главный компонент приложения
export default function App() {
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

  const InputField = ({ label, name, step = 1, min = 0, max }) => (
    <div className="flex justify-between items-center mb-2">
      <label className="text-sm text-gray-700 font-medium">{label}</label>
      <input
        type="number"
        name={name}
        value={params[name]}
        onChange={handleChange}
        step={step}
        min={min}
        max={max}
        className="w-20 p-1 border border-gray-300 rounded text-right text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-gray-50 overflow-hidden font-sans">
      {/* ЛЕВАЯ ПАНЕЛЬ */}
      <div className="w-80 md:w-96 bg-white shadow-xl z-10 flex flex-col h-full">
        <div className="p-5 bg-blue-600 text-white">
          <h1 className="text-xl font-bold">Конфигуратор Органайзера</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">
              1. Параметры 3D печати
            </h2>
            <InputField
              label="Ширина линии (мм)"
              name="lineWidth"
              step={0.01}
            />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">
              2. Габариты коробки
            </h2>
            <InputField label="Ширина - X (мм)" name="width" />
            <InputField label="Глубина - Y (мм)" name="depth" />
            <InputField label="Высота - Z (мм)" name="height" />
            <InputField
              label="Толщина дна (мм)"
              name="bottomThickness"
              step={0.1}
            />
            <InputField label="Внешние стенки (линий)" name="outerWallLines" />
            <InputField label="Радиус скругления (мм)" name="cornerRadius" />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-1">
              3. Параметры ячеек
            </h2>
            <InputField label="Кол-во по X (колонок)" name="gridX" />
            <InputField label="Кол-во по Y (строк)" name="gridY" />
            <InputField
              label="Внутренние стенки (линий)"
              name="innerWallLines"
            />
            <InputField
              label="Высота разделителей (мм)"
              name="dividerHeight"
              step={0.1}
              max={params.height - params.bottomThickness}
            />

            <CellMap2D params={params} setParams={setParams} />
          </section>
        </div>

        <div className="p-5 border-t bg-gray-50">
          <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-md">
            Экспорт в STL
          </button>
        </div>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ */}
      <div className="flex-1 relative bg-gray-100">
        <Canvas camera={{ position: [150, 150, 150], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[100, 200, 100]}
            intensity={1}
            castShadow
          />
          <Environment preset="city" />
          <OrbitControls makeDefault />
          <Grid
            infiniteGrid
            fadeDistance={1000}
            sectionColor="#cccccc"
            cellColor="#eeeeee"
          />

          <OrganizerModel params={params} />
        </Canvas>

        <div className="absolute bottom-6 right-6 bg-white/80 px-4 py-2 rounded-md shadow text-sm text-gray-600 pointer-events-none">
          ЛКМ - вращение | ПКМ - перемещение | Колесико - зум
        </div>
      </div>
    </div>
  );
}
