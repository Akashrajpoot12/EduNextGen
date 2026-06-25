// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTenant } from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, ScanFace, CheckCircle2, AlertCircle, RefreshCw, UserPlus, FileWarning, Play, Loader2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as faceapi from "face-api.js";

export function FaceAiPage() {
  const supabase = createClient();
  const { tenantId: schoolId } = useTenant();

  const [activeTab, setActiveTab]       = useState<"scanner" | "register">("scanner");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [mediaStream, setMediaStream]   = useState<MediaStream | null>(null);
  const [cameraError, setCameraError]   = useState<string | null>(null);

  // Scanner
  const [isScanning, setIsScanning]       = useState(false);
  const [scanResult, setScanResult]       = useState<null | "success" | "error">(null);
  const [detectedStudent, setDetectedStudent] = useState<any>(null);

  // Register
  const [students, setStudents]           = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [registeredFaces, setRegisteredFaces] = useState<any[]>([]); // from DB
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [savingFace, setSavingFace]       = useState(false);

  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load face-api models
  useEffect(() => {
    (async () => {
      try {
        const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        toast.success("AI Models loaded");
      } catch {
        toast.error("Failed to load AI models. Check internet connection.");
      }
    })();
  }, []);

  // Load students + registered faces from Supabase
  useEffect(() => {
    if (!schoolId) return;
    loadStudentsAndFaces();
  }, [schoolId]);

  async function loadStudentsAndFaces() {
    setLoadingStudents(true);
    const [{ data: studs }, { data: faces }] = await Promise.all([
      supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_number, face_vector, classes:class_id(grade_level,section)")
        .eq("school_id", schoolId)
        .order("first_name"),
      supabase
        .from("students")
        .select("id, first_name, last_name, enrollment_number, face_vector, classes:class_id(grade_level,section)")
        .eq("school_id", schoolId)
        .not("face_vector", "is", null),
    ]);
    setStudents(studs || []);
    setRegisteredFaces((faces || []).map(s => ({
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      enrollment: s.enrollment_number,
      classInfo: s.classes ? `Class ${s.classes.grade_level}-${s.classes.section}` : "—",
      descriptor: new Float32Array(Object.values(s.face_vector)),
    })));
    setLoadingStudents(false);
  }

  useEffect(() => {
    if (isCameraActive && mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [isCameraActive, mediaStream]);

  useEffect(() => {
    if (isCameraActive) stopCamera();
    setScanResult(null);
  }, [activeTab]);

  async function startCamera() {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setMediaStream(stream);
      setIsCameraActive(true);
    } catch {
      setCameraError("Camera access denied or device not found.");
      toast.error("Please allow camera access.");
    }
  }

  function stopCamera() {
    mediaStream?.getTracks().forEach(t => t.stop());
    setMediaStream(null);
    setIsCameraActive(false);
    stopScanner();
  }

  // ── REGISTER ──────────────────────────────────────────────
  async function registerFace() {
    if (!videoRef.current || !selectedStudentId) {
      toast.error("Select a student and start camera first.");
      return;
    }
    setSavingFace(true);
    const toastId = toast.loading("Capturing biometrics...");
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected! Look directly at camera.", { id: toastId });
        setSavingFace(false);
        return;
      }

      // Convert Float32Array to plain array for JSON storage
      const vectorArray = Array.from(detection.descriptor);

      const { error } = await supabase
        .from("students")
        .update({ face_vector: vectorArray })
        .eq("id", selectedStudentId);

      if (error) throw error;

      const student = students.find(s => s.id === selectedStudentId);
      toast.success(`${student?.first_name}'s face registered & saved!`, { id: toastId });
      setSelectedStudentId("");
      await loadStudentsAndFaces();
    } catch (err: any) {
      toast.error("Error saving face: " + err.message, { id: toastId });
    }
    setSavingFace(false);
  }

  async function deleteFace(studentId: string, name: string) {
    if (!confirm(`Remove face data for ${name}?`)) return;
    await supabase.from("students").update({ face_vector: null }).eq("id", studentId);
    toast.success(`Face data removed for ${name}`);
    loadStudentsAndFaces();
  }

  // ── SCANNER ───────────────────────────────────────────────
  function startScanner() {
    if (!isCameraActive || registeredFaces.length === 0) {
      toast.error(registeredFaces.length === 0 ? "Register at least one face first!" : "Start camera first!");
      return;
    }
    setIsScanning(true);
    setScanResult(null);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused) return;

      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const resized = faceapi.resizeResults(detection, displaySize);
        canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        faceapi.draw.drawDetections(canvasRef.current, resized);

        const labeled = registeredFaces.map(f => new faceapi.LabeledFaceDescriptors(f.id, [f.descriptor]));
        const matcher = new faceapi.FaceMatcher(labeled, 0.55);
        const match   = matcher.findBestMatch(detection.descriptor);

        if (match.label !== "unknown") {
          const matched = registeredFaces.find(f => f.id === match.label);
          setScanResult("success");
          setDetectedStudent({
            name: matched?.name,
            enrollment: matched?.enrollment,
            classInfo: matched?.classInfo,
            time: new Date().toLocaleTimeString("en-IN"),
            distance: match.distance,
          });

          // Mark present in daily_attendance
          const today = new Date().toISOString().split("T")[0];
          await supabase.from("daily_attendance").upsert({
            student_id: match.label,
            school_id: schoolId,
            date: today,
            status: "present",
            marked_by: "face_ai",
          }, { onConflict: "student_id,date" });

          toast.success(`Attendance marked for ${matched?.name}`);
          stopScanner();
        }
      } else {
        canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }, 500);
  }

  function stopScanner() {
    setIsScanning(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  const unregistered = students.filter(s => !s.face_vector);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            Biometric AI
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-widest">Live</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time facial recognition — {registeredFaces.length} faces registered, {unregistered.length} pending
          </p>
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          <Button variant={activeTab === "scanner" ? "default" : "ghost"} size="sm"
            onClick={() => setActiveTab("scanner")}
            className={activeTab === "scanner" ? "bg-background text-foreground shadow-sm" : ""}>
            <ScanFace className="w-4 h-4 mr-2" /> Scanner
          </Button>
          <Button variant={activeTab === "register" ? "default" : "ghost"} size="sm"
            onClick={() => setActiveTab("register")}
            className={activeTab === "register" ? "bg-background text-foreground shadow-sm" : ""}>
            <UserPlus className="w-4 h-4 mr-2" /> Register Face
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera */}
        <Card className="lg:col-span-2 bg-card border-border shadow-xl overflow-hidden">
          <CardContent className="p-0 aspect-video relative flex flex-col items-center justify-center bg-black/90">
            {!modelsLoaded ? (
              <div className="text-center text-muted-foreground">
                <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-emerald-500" />
                <p>Loading AI Neural Networks...</p>
                <p className="text-xs opacity-50 mt-2">(~2–3 MB from GitHub)</p>
              </div>
            ) : !isCameraActive ? (
              <div className="text-center">
                <Camera className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                {cameraError
                  ? <p className="text-red-400 mb-4">{cameraError}</p>
                  : <p className="text-muted-foreground mb-6">Camera is inactive</p>}
                <Button onClick={startCamera} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Play className="w-5 h-5 mr-2" /> Enable Camera
                </Button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover z-10" />
                <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-foreground font-mono bg-black/50 px-2 py-1 rounded border border-border">LIVE</span>
                </div>
                <div className="absolute bottom-4 right-4 z-20">
                  <Button variant="destructive" size="sm" onClick={stopCamera}>Turn Off</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="space-y-4">
          {activeTab === "register" ? (
            <Card className="bg-card border-border shadow-xl">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-lg">Register Face</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {loadingStudents ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Student</label>
                    <select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option value="">-- Choose student --</option>
                      {unregistered.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name} ({s.enrollment_number})
                        </option>
                      ))}
                    </select>
                    {unregistered.length === 0 && (
                      <p className="text-xs text-emerald-600 font-medium">✓ All students registered!</p>
                    )}
                  </div>
                )}

                <Button onClick={registerFace}
                  disabled={!isCameraActive || !selectedStudentId || savingFace}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  {savingFace
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    : <><ScanFace className="w-4 h-4 mr-2" /> Capture & Save</>}
                </Button>

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium">Registered Faces</span>
                    <span className="bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded text-xs font-bold">{registeredFaces.length}</span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {registeredFaces.map(f => (
                      <div key={f.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{f.classInfo}</p>
                        </div>
                        <button type="button" title="Remove face" onClick={() => deleteFace(f.id, f.name)}
                          className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-xl">
              <CardContent className="p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <h3 className="text-lg font-bold">Live Scanner</h3>
                  {isScanning && (
                    <span className="flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full animate-pulse">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Scanning
                    </span>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {!scanResult && !isScanning && (
                    <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                      <ScanFace className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm text-muted-foreground mb-4">Ready to scan faces</p>
                      <Button onClick={startScanner} disabled={!isCameraActive || registeredFaces.length === 0}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                        Start AI Attendance
                      </Button>
                      {registeredFaces.length === 0 && (
                        <p className="text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                          <FileWarning className="w-3 h-3" /> Register a face first
                        </p>
                      )}
                    </motion.div>
                  )}

                  {!scanResult && isScanning && (
                    <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                      <div className="relative w-28 h-28 mx-auto border-2 border-dashed border-emerald-500/50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                        <motion.div animate={{ y: ["-100%", "100%"] }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                          className="absolute left-0 right-0 h-1 bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
                        <ScanFace className="w-10 h-10 text-emerald-500/50" />
                      </div>
                      <Button variant="outline" onClick={stopScanner} className="w-full">Stop Scanning</Button>
                    </motion.div>
                  )}

                  {scanResult === "success" && detectedStudent && (
                    <motion.div key="success" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/50">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div className="text-center">
                        <h4 className="text-xl font-bold">{detectedStudent.name}</h4>
                        <p className="text-emerald-600 text-sm font-medium">✓ Marked Present</p>
                      </div>
                      <div className="bg-muted rounded-lg p-4 border border-border space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Roll No</span><span className="font-medium">{detectedStudent.enrollment}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Class</span><span className="font-medium">{detectedStudent.classInfo}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{detectedStudent.time}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span><span className="font-medium">{Math.round((1 - detectedStudent.distance) * 100)}%</span></div>
                      </div>
                      <Button onClick={startScanner} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                        Scan Next Student
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}

          {/* Stats card */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold">Face Registration Status</p>
                  <p className="text-xs text-muted-foreground">{registeredFaces.length} registered · {unregistered.length} pending</p>
                </div>
              </div>
              {students.length > 0 && (
                <div className="mt-3 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.round((registeredFaces.length / students.length) * 100)}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
