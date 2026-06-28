import { Navigate, useParams } from "react-router-dom";

/**
 * The old localStorage-only biometric device simulator has been retired.
 * Biometric attendance is now handled by the real Face AI system
 * (FaceAiPage in the browser + the face-attendance companion service),
 * so this route simply forwards there.
 */
export function BiometricPage() {
  const { tenantId } = useParams();
  return <Navigate to={`/${tenantId}/admin/face-ai`} replace />;
}
