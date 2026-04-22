import { CameraError, CameraErrorKind } from '../models/camera-error';

const CAMERA_ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  [CameraErrorKind.PermissionDenied]:
    'Camera access was blocked. Allow it in your browser settings to continue.',
  [CameraErrorKind.DeviceNotFound]: 'No camera detected. Connect one and try again.',
  [CameraErrorKind.Overconstrained]: 'Your camera does not support the requested resolution.',
  [CameraErrorKind.InUse]: 'The camera is in use by another application.',
  [CameraErrorKind.Unknown]: 'Unable to access the camera.',
};

function kindFromError(err: unknown): CameraErrorKind {
  if (!(err instanceof DOMException)) {
    return CameraErrorKind.Unknown;
  }
  switch (err.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return CameraErrorKind.PermissionDenied;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return CameraErrorKind.DeviceNotFound;
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return CameraErrorKind.Overconstrained;
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return CameraErrorKind.InUse;
    default:
      return CameraErrorKind.Unknown;
  }
}

export function classifyCameraError(err: unknown): CameraError {
  const kind = kindFromError(err);
  return new CameraError(kind, CAMERA_ERROR_MESSAGES[kind], { cause: err });
}
