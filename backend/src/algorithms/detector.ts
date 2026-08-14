
export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  isPothole: boolean;
  confidence: number; 
  boundingBox: DetectionBox | null; 
  
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  classProbs?: number[];
  
  message?: string;
}


export interface PotholeDetector {
  detect(imageBuffer: Buffer): Promise<DetectionResult>;
}
