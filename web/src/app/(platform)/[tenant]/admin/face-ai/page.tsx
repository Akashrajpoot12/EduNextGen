"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, ScanFace, CheckCircle2, AlertCircle, RefreshCw, UserPlus, FileWarning, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import * as faceapi from "face-api.js";

// Mock Database of Registered Faces for the Demo
// In production, this would come from Supabase
interface RegisteredFace {
  name: string;
  descriptor: Float32Array;
  classInfo: string;
}

export default function FaceAIPage() {
  const [activeTab, setActiveTab] = useState<"scanner" | "register">("scanner");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<null | "success" | "error">(null);
  const [detectedStudent, setDetectedStudent] = useState<any>(null);
  
  // Register States
  const [registerName, setRegisterName] = useState("");
  const [registerClass, setRegisterClass] = useState("10th - A");
  const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Models on Mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
        toast.success("AI Models Loaded Successfully");
      } catch (err) {
        console.error("Error loading models:", err);
        toast.error("Failed to load AI Models. Check your internet connection.");
      }
    };
    loadModels();

    return () => {
      // Cleanup on unmount
    };
  }, []);

  // Ensure stream is attached when video element mounts
  useEffect(() => {
    if (isCameraActive && mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [isCameraActive, mediaStream]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setMediaStream(stream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access denied:", err);
      setCameraError("Camera access denied or device not found.");
      toast.error("Please allow camera access in your browser.");
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    setMediaStream(null);
    setIsCameraActive(false);
    stopScanner();
  };

  // Switch tabs -> stop camera to prevent locking
  useEffect(() => {
    if (isCameraActive) {
      stopCamera();
    }
    setScanResult(null);
  }, [activeTab]);


  // --------------------------------------------------------------------------
  // REGISTRATION FLOW
  // --------------------------------------------------------------------------
  const registerFace = async () => {
    if (!videoRef.current || !registerName) {
      toast.error("Please enter a name and ensure camera is running.");
      return;
    }

    const toastId = toast.loading("Capturing biometrics...");
    
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error("No face detected! Please look directly at the camera.", { id: toastId });
        return;
      }

      // Save to mock database
      const newFace: RegisteredFace = {
        name: registerName,
        descriptor: detection.descriptor,
        classInfo: registerClass,
      };

      setRegisteredFaces([...registeredFaces, newFace]);
      toast.success(`${registerName}'s face registered successfully!`, { id: toastId });
      setRegisterName("");
      
    } catch (error) {
      toast.error("Error capturing face. Try again.", { id: toastId });
    }
  };

  // --------------------------------------------------------------------------
  // SCANNER FLOW
  // --------------------------------------------------------------------------
  const startScanner = () => {
    if (!isCameraActive || registeredFaces.length === 0) {
      toast.error(registeredFaces.length === 0 ? "Please register at least one face first!" : "Start the camera first!");
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
        // Draw boxes on canvas
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);
        const resizedDetection = faceapi.resizeResults(detection, displaySize);
        canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        faceapi.draw.drawDetections(canvasRef.current, resizedDetection);

        // Matching
        const labeledDescriptors = registeredFaces.map(f => new faceapi.LabeledFaceDescriptors(f.name, [f.descriptor]));
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55); // 0.55 is threshold distance
        const match = faceMatcher.findBestMatch(detection.descriptor);

        if (match.label !== "unknown") {
          // Success!
          const matchedFace = registeredFaces.find(f => f.name === match.label);
          setScanResult("success");
          setDetectedStudent({
            name: match.label,
            class: matchedFace?.classInfo || "Unknown",
            rollNumber: "Auto-" + Math.floor(Math.random() * 100),
            time: new Date().toLocaleTimeString(),
            distance: match.distance
          });
          
          toast.success(`Attendance marked for ${match.label}`);
          stopScanner();
        } else {
          // Found a face, but not registered
          if (scanResult !== "error") {
             // Avoid spamming error state, maybe just wait. Let's log error if it persists for 3 frames, but for demo we just show scanning box.
             // We can optionally draw an unknown box.
          }
        }
      } else {
         canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }, 500); // 2fps for performance
  };

  const stopScanner = () => {
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    if (canvasRef.current) {
      canvasRef.current.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const testAutoSMS = () => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 2000)),
      {
        loading: 'Running Absentee Cron Job...',
        success: 'SMS Sent to 4 Parents (Absent Students)',
        error: 'Failed to send SMS',
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            Biometric AI <span className="ml-3 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] uppercase font-bold tracking-widest">Live</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time facial recognition using TensorFlow browser models.</p>
        </div>
        <div className="flex bg-muted p-1 rounded-lg">
          <Button 
            variant={activeTab === "scanner" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setActiveTab("scanner")}
            className={activeTab === "scanner" ? "bg-background text-foreground shadow-sm" : ""}
          >
            <ScanFace className="w-4 h-4 mr-2" /> Scanner
          </Button>
          <Button 
            variant={activeTab === "register" ? "default" : "ghost"} 
            size="sm" 
            onClick={() => setActiveTab("register")}
            className={activeTab === "register" ? "bg-background text-foreground shadow-sm" : ""}
          >
            <UserPlus className="w-4 h-4 mr-2" /> Register Face
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Window */}
        <Card className="lg:col-span-2 bg-card border-border shadow-xl overflow-hidden relative">
          <CardContent className="p-0 aspect-video relative flex flex-col items-center justify-center bg-black/90">
            {!modelsLoaded ? (
              <div className="text-center text-slate-400">
                <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-emerald-500" />
                <p>Loading AI Neural Networks...</p>
                <p className="text-xs opacity-50 mt-2">(approx 2-3MB from GitHub)</p>
              </div>
            ) : !isCameraActive ? (
              <div className="text-center">
                <Camera className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                {cameraError ? (
                  <p className="text-red-400 mb-4">{cameraError}</p>
                ) : (
                  <p className="text-slate-400 mb-6">Camera is currently inactive</p>
                )}
                <Button onClick={startCamera} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Play className="w-5 h-5 mr-2" /> Enable Camera
                </Button>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                />
                <canvas 
                  ref={canvasRef} 
                  className="absolute top-0 left-0 w-full h-full object-cover z-10"
                />
                
                {/* Overlay UI */}
                <div className="absolute top-4 left-4 flex items-center space-x-2 z-20">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white font-mono bg-black/50 px-2 py-1 rounded border border-white/10">LIVE FEED</span>
                </div>
                
                <div className="absolute bottom-4 right-4 z-20">
                  <Button variant="destructive" size="sm" onClick={stopCamera}>Turn Off Camera</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Panel */}
        <div className="space-y-6">
          {activeTab === "register" ? (
            <Card className="bg-card border-border shadow-xl h-full">
              <CardHeader className="border-b border-border pb-4">
                <CardTitle className="text-lg">Register New Face</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Student Name</label>
                  <input 
                    type="text" 
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="e.g. Rahul Kumar" 
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Class</label>
                  <select 
                    value={registerClass}
                    onChange={(e) => setRegisterClass(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option>10th - A</option>
                    <option>12th - Science</option>
                    <option>8th - B</option>
                  </select>
                </div>
                
                <Button 
                  onClick={registerFace} 
                  disabled={!isCameraActive || !registerName}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-4"
                >
                  <ScanFace className="w-4 h-4 mr-2" /> Capture & Save Biometrics
                </Button>

                <div className="mt-8 pt-6 border-t border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Database Statistics</h4>
                  <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg border border-border">
                    <span className="text-sm text-foreground">Registered Faces</span>
                    <span className="bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded text-xs font-bold">{registeredFaces.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border shadow-xl h-full">
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                  <h3 className="text-lg font-bold text-foreground">Live Scanner</h3>
                  {isScanning && (
                    <span className="flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full animate-pulse">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Scanning
                    </span>
                  )}
                </div>
                
                <div className="flex-grow flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {!scanResult && !isScanning && (
                      <motion.div 
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center w-full"
                      >
                        <ScanFace className="w-12 h-12 mx-auto mb-3 opacity-20 text-foreground" />
                        <p className="text-sm text-muted-foreground mb-6">Ready to scan attendees</p>
                        <Button 
                          onClick={startScanner} 
                          disabled={!isCameraActive || registeredFaces.length === 0}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          Start AI Attendance
                        </Button>
                        {registeredFaces.length === 0 && (
                          <p className="text-xs text-red-400 mt-2 flex items-center justify-center">
                            <FileWarning className="w-3 h-3 mr-1" /> Register a face first
                          </p>
                        )}
                      </motion.div>
                    )}

                    {!scanResult && isScanning && (
                      <motion.div 
                        key="scanning"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center w-full"
                      >
                         <div className="relative w-32 h-32 mx-auto border-2 border-dashed border-emerald-500/50 rounded-xl mb-4 flex items-center justify-center">
                            <motion.div 
                              animate={{ y: ["-100%", "100%"] }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                              className="absolute left-0 right-0 h-1 bg-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.8)]"
                            />
                            <ScanFace className="w-10 h-10 text-emerald-500/50" />
                         </div>
                         <Button variant="outline" onClick={stopScanner} className="w-full">
                           Stop Scanning
                         </Button>
                      </motion.div>
                    )}

                    {scanResult === 'success' && detectedStudent && (
                      <motion.div 
                        key="success"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full"
                      >
                        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h4 className="text-xl font-bold text-foreground text-center mb-1">{detectedStudent.name}</h4>
                        <p className="text-emerald-600 dark:text-emerald-400 text-center text-sm mb-6 font-medium">
                          Match Distance: {detectedStudent.distance.toFixed(2)} • Marked Present
                        </p>
                        
                        <div className="bg-muted rounded-lg p-4 border border-border space-y-3 mb-6">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Class</span>
                            <span className="text-foreground font-medium">{detectedStudent.class}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Time</span>
                            <span className="text-foreground font-medium">{detectedStudent.time}</span>
                          </div>
                        </div>
                        
                        <Button onClick={startScanner} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                          Scan Next Student
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bonus: Auto SMS Mock */}
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">9:00 AM Cron Job</p>
                  <p className="text-xs text-muted-foreground">Auto-SMS to absent parents</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={testAutoSMS}>Run Test</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}