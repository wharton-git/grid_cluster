import { MoveLeft, Settings } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { generateFractal } from "../utils/request";
import { type Data, type Point, type Page } from "../utils/types";

interface FractalProps {
    onNavigate: (page: Page) => void;
}

const Fractal: React.FC<FractalProps> = ({ onNavigate }) => {

    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [formData, setFormData] = useState<Data>({
        type: 'mandelbrot',
        iterations: 2000,
        size: 'medium',
        devMode: true
    });

    const [points, setPoints] = useState<Point[]>([]);
    const [zoom, setZoom] = useState(1);
    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [devMode, setDevMode] = useState(true);

    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });

    // ---------------------
    // HANDLERS
    // ---------------------
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: name === "iterations" ? parseInt(value) || 0 : value
        }));
    };

    // const handleDevToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    //     setDevMode(e.target.value === "dev");
    // };

    const fetchFractal = useCallback(async (data: Data, _cx = center.x, _cy = center.y, _z = zoom) => {
        try {
            const response = await generateFractal({ ...data, devMode });
            if (response?.points) {
                setPoints(response.points);
                setOffset({ x: 0, y: 0 });
            }
        } catch (err) {
            console.error(err);
        }
    }, [center.x, center.y, zoom, devMode]);

    const handleApply = () => {
        fetchFractal(formData);
    };

    // ---------------------
    // CANVAS DRAW
    // ---------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || points.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const scaleX = canvas.width / (maxX - minX);
        const scaleY = canvas.height / (maxY - minY);
        const baseScale = Math.min(scaleX, scaleY) * zoom;

        points.forEach((p, i) => {
            const x = (p.x - minX) * baseScale + offset.x;
            const y = (p.y - minY) * baseScale + offset.y;
            ctx.fillStyle = `hsl(${i % 360}, 100%, 50%)`;
            ctx.fillRect(x, y, 1, 1);
        });
    }, [points, zoom, offset]);

    // ---------------------
    // ZOOM / PAN
    // ---------------------
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
            const newZoom = zoom * zoomFactor;

            setCenter(prev => ({
                x: prev.x + (mouseX - canvas.width / 2) * (1 / zoom - 1 / newZoom),
                y: prev.y + (mouseY - canvas.height / 2) * (1 / zoom - 1 / newZoom)
            }));

            setZoom(newZoom);
            fetchFractal(formData, center.x, center.y, newZoom);
        };

        canvas.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            canvas.removeEventListener("wheel", handleWheel);
        };
    }, [zoom, center, fetchFractal, formData]);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;

        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        isDragging.current = false;
    };

    // ---------------------
    // JSX
    // ---------------------
    return (
        <div className="h-screen w-screen p-5">
            <div className="flex items-center">
                <button onClick={() => onNavigate("Home")} className="btn btn-circle btn-primary">
                    <MoveLeft />
                </button>
            </div>

            <div className="grid grid-cols-5 h-9/10 justify-center items-center">
                {/* SETTINGS */}
                <div className="col-span-1 p-4 translate-x-15">
                    <div className="flex gap-2 font-bold">
                        <Settings />
                        Settings
                    </div>

                    <div className="flex flex-col gap-3">
                        <fieldset className="fieldset">
                            <legend className="fieldset-legend">Type</legend>
                            <select
                                name="type" value={formData.type}
                                onChange={handleChange}
                                className="select"
                            >
                                <option value="mandelbrot">Mandelbrot</option>
                                <option value="barnsley">Barnsley</option>
                            </select>
                        </fieldset>

                        <fieldset className="fieldset">
                            <legend className="fieldset-legend">Iterations</legend>
                            <input
                                type="number"
                                name="iterations"
                                className="input"
                                value={formData.iterations}
                                onChange={handleChange}
                            />
                        </fieldset>

                        <fieldset className="fieldset">
                            <legend className="fieldset-legend">Size</legend>
                            <select
                                name="size" value={formData.size}
                                onChange={handleChange}
                                className="select"
                            >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                            </select>
                        </fieldset>

                        <div className="flex gap-2 justify-center">
                            <label className="flex gap-2 -translate-x-0.5">
                                <span className="text-md">Prod Mode</span>
                                <input
                                    type="checkbox"
                                    checked={devMode}
                                    onChange={(e) => setDevMode(e.target.checked)}
                                    className="toggle theme-controller translate-y-0.5"
                                />
                                <span className="text-md">Dev Mode</span>
                            </label>
                        </div>
                    </div>

                    <div className="w-full  flex justify-center mt-5">
                        <button className="btn btn-primary" onClick={handleApply}>
                            Apply
                        </button>
                    </div>
                </div>

                {/* CANVAS */}
                <div className="col-span-4 flex justify-center items-center">
                    <canvas
                        ref={canvasRef}
                        width={900}
                        height={600}
                        className="rounded-xl shadow-lg "
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </div>
            </div>
        </div>
    );
};

export default Fractal;