export const POINT_CLOUD_EXTENSION_ID = "@gggplot/3d:geom_point_cloud@1";

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export interface PointCloudCamera {
  projection: "perspective" | "orthographic";
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  near?: number;
  far?: number;
  fovY?: number;
  orthographicHeight?: number;
  aspect?: number;
}

/** Plain JSON input contract; executable package values never enter the spec. */
export interface PointCloudSpec {
  extension: typeof POINT_CLOUD_EXTENSION_ID;
  data: Record<string, Array<number | string | null>>;
  mapping: {
    x: string;
    y: string;
    z: string;
    color?: string;
    size?: string;
  };
  camera: PointCloudCamera;
  params?: {
    color?: Vec4;
    size?: number;
    opacity?: number;
    depthTest?: boolean;
  };
}

export interface PointCloudRenderProps {
  positions: Float32Array;
  colors?: Float32Array;
  sizes?: Float32Array;
  color?: Vec4;
  size: number;
  opacity: number;
  depthTest: boolean;
  depthWrite: boolean;
  formats: { positions: "vec4<f32>" };
  camera: Required<PointCloudCamera>;
}

export interface PointCloudRenderNode {
  component: typeof POINT_CLOUD_EXTENSION_ID;
  props: PointCloudRenderProps;
  children: [];
}
