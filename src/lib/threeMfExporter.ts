/**
 * 3MF (3D Manufacturing Format) Exporter with Multi-Color & Multi-Filament Support
 * Compatible with Bambu Studio, OrcaSlicer, PrusaSlicer, Creality Print, and Cura.
 */
import JSZip from "jszip";
import * as THREE from "three";

export interface FilamentDefinition {
  name: string;
  color: string; // Hex format: #RRGGBB or #RRGGBBAA
  type?: string; // PLA, PETG, TPU, etc.
}

export interface ThreeMfMeshItem {
  geometry: THREE.BufferGeometry;
  name: string;
  filamentIndex: number; // Index in the filaments array (0-based)
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export interface ThreeMfExportOptions {
  title?: string;
  designer?: string;
  filaments: FilamentDefinition[];
  items: ThreeMfMeshItem[];
  unit?: "millimeter" | "inch";
}

/**
 * Format hex color to 3MF required uppercase `#RRGGBB` or `#RRGGBBAA`
 */
function normalizeColor(hex: string): string {
  let clean = hex.trim().replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map(c => c + c).join("");
  }
  if (clean.length === 6) {
    return `#${clean.toUpperCase()}`;
  }
  if (clean.length === 8) {
    return `#${clean.toUpperCase()}`;
  }
  return "#00E5FF";
}

/**
 * Converts THREE.BufferGeometry into 3MF mesh XML string
 */
function geometryTo3MfMesh(
  geometry: THREE.BufferGeometry,
  defaultColorIndex: number,
  colorgroupId: number = 1
): { verticesXml: string; trianglesXml: string } {
  const geom = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geom.computeVertexNormals();

  const posAttr = geom.getAttribute("position");
  if (!posAttr) {
    return { verticesXml: "", trianglesXml: "" };
  }

  // We can de-duplicate vertices for cleaner and smaller 3MF file
  const vertices: string[] = [];
  const vertexMap = new Map<string, number>();
  const triangleIndices: number[] = [];

  const precision = 4;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    // Format coordinates
    const key = `${x.toFixed(precision)}_${y.toFixed(precision)}_${z.toFixed(precision)}`;
    let vIdx = vertexMap.get(key);
    if (vIdx === undefined) {
      vIdx = vertices.length;
      vertexMap.set(key, vIdx);
      vertices.push(`<vertex x="${x.toFixed(precision)}" y="${y.toFixed(precision)}" z="${z.toFixed(precision)}" />`);
    }
    triangleIndices.push(vIdx);
  }

  const triangles: string[] = [];
  const p1Attr = defaultColorIndex;

  for (let i = 0; i < triangleIndices.length; i += 3) {
    const v1 = triangleIndices[i];
    const v2 = triangleIndices[i + 1];
    const v3 = triangleIndices[i + 2];

    // Ensure non-degenerate triangle
    if (v1 !== v2 && v2 !== v3 && v1 !== v3) {
      triangles.push(
        `<triangle v1="${v1}" v2="${v2}" v3="${v3}" pid="${colorgroupId}" p1="${p1Attr}" />`
      );
    }
  }

  return {
    verticesXml: vertices.join("\n        "),
    trianglesXml: triangles.join("\n        ")
  };
}

/**
 * XML-escape a string for use in attribute values.
 */
function xmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Generate minimal BambuStudio project_settings.config.
 * Covers the essential ~50 settings needed for BambuStudio to recognise the
 * file as a native project with sensible defaults (PLA, 0.2mm, 15% gyroid).
 */
function buildProjectSettingsConfig(filaments: FilamentDefinition[]): string {
  const filamentCount = filaments.length;
  const filamentColours = filaments.map(f => normalizeColor(f.color));
  const arr = (vals: string[]) => JSON.stringify(vals);

  const settings: Record<string, unknown> = {
    name: "project_settings",
    version: "01.10.01.50",
    from: "project",

    // Printer
    printer_model: "Bambu Lab A1",
    printer_settings_id: "Bambu Lab A1 0.4 nozzle",
    printer_structure: "corexy",
    printer_technology: "FFF",
    printer_variant: "0.4",
    nozzle_diameter: ["0.4"],
    nozzle_type: "stainless_steel",
    nozzle_height: "4.2",
    nozzle_volume: "107",

    // Bed
    curr_bed_type: "Textured PEI Plate",
    printable_area: ["0x0", "256x0", "256x256", "0x256"],
    printable_height: "250",

    // Quality
    layer_height: "0.2",
    initial_layer_print_height: "0.2",
    line_width: "0.42",
    resolution: "0.012",

    // Walls
    wall_loops: "3",
    wall_sequence: "inner wall/outer wall",
    wall_generator: "classic",
    outer_wall_line_width: "0.42",
    inner_wall_line_width: "0.45",
    outer_wall_speed: "200",
    inner_wall_speed: "300",

    // Top/Bottom shells
    top_shell_layers: "4",
    bottom_shell_layers: "3",
    top_shell_thickness: "1",
    bottom_surface_pattern: "monotonic",
    top_surface_pattern: "monotonicline",

    // Infill
    sparse_infill_density: "15%",
    sparse_infill_pattern: "gyroid",
    sparse_infill_line_width: "0.45",
    sparse_infill_speed: "270",
    sparse_infill_acceleration: "100%",

    // Support
    enable_support: "0",
    support_type: "normal(auto)",
    support_style: "default",
    support_threshold_angle: "30",

    // Adhesion
    brim_type: "auto_brim",
    brim_width: "5",
    brim_object_gap: "0.1",
    skirt_loops: "0",

    // Speeds
    default_acceleration: "10000",
    outer_wall_acceleration: "5000",
    top_surface_acceleration: "2000",
    initial_layer_acceleration: "500",
    initial_layer_speed: "50",
    travel_speed: "500",
    gap_infill_speed: "250",
    internal_solid_infill_speed: "250",
    top_surface_speed: "200",

    // Retraction
    retraction_length: ["0.8"],
    retraction_speed: ["30"],
    retraction_minimum_travel: ["1"],
    deretraction_speed: ["30"],

    // Temperatures (PLA defaults)
    nozzle_temperature: ["220"],
    nozzle_temperature_initial_layer: ["220"],
    nozzle_temperature_range_high: ["240"],
    nozzle_temperature_range_low: ["190"],
    cool_plate_temp: ["35"],
    cool_plate_temp_initial_layer: ["35"],
    hot_plate_temp: ["55"],
    hot_plate_temp_initial_layer: ["55"],
    textured_plate_temp: ["55"],
    textured_plate_temp_initial_layer: ["55"],
    eng_plate_temp: ["0"],
    eng_plate_temp_initial_layer: ["0"],
    temperature_vitrification: ["45"],

    // Fan
    fan_min_speed: ["100"],
    fan_max_speed: ["100"],
    close_fan_the_first_x_layers: ["1"],
    full_fan_speed_layer: ["0"],
    enable_overhang_bridge_fan: ["1"],
    overhang_fan_speed: ["100"],

    // Filament (per-slot arrays)
    filament_colour: filamentColours,
    filament_type: Array.from({ length: filamentCount }, () => "PLA"),
    filament_vendor: Array.from({ length: filamentCount }, () => "Bambu Lab"),
    filament_diameter: Array.from({ length: filamentCount }, () => "1.75"),
    filament_density: Array.from({ length: filamentCount }, () => "1.26"),
    filament_flow_ratio: Array.from({ length: filamentCount }, () => "0.98"),
    filament_max_volumetric_speed: Array.from({ length: filamentCount }, () => "21"),
    filament_settings_id: filaments.map(() => "Bambu PLA Basic @BBL A1"),
    filament_shrink: Array.from({ length: filamentCount }, () => "100%"),
    filament_is_support: Array.from({ length: filamentCount }, () => "0"),
    filament_soluble: Array.from({ length: filamentCount }, () => "0"),
    filament_retraction_length: Array.from({ length: filamentCount }, () => "nil"),
    filament_start_gcode: Array.from({ length: filamentCount }, () =>
      "; filament start gcode\n{if  (bed_temperature[current_extruder] >55)||(bed_temperature_initial_layer[current_extruder] >55)}M106 P3 S200\n{elsif(bed_temperature[current_extruder] >50)||(bed_temperature_initial_layer[current_extruder] >50)}M106 P3 S150\n{elsif(bed_temperature[current_extruder] >45)||(bed_temperature_initial_layer[current_extruder] >45)}M106 P3 S50\n{endif}\nM142 P1 R35 S40"
    ),
    filament_end_gcode: Array.from({ length: filamentCount }, () => "; filament end gcode\nM106 P3 S0\n"),

    // Extruder
    extruder_colour: [""],
    extruder_offset: ["0x0"],
    extruder_type: ["DirectDrive"],
    single_extruder_multi_material: "1",

    // Print sequence
    print_sequence: "by layer",

    // Plate & misc
    default_print_profile: "0.20mm Standard @BBL A1",
    print_settings_id: "0.20mm Standard @BBL A1",
    print_compatible_printers: ["Bambu Lab A1 0.4 nozzle"],
    compatible_printers_condition: "",
    enable_prime_tower: "1",
    prime_tower_width: "35",
    prime_volume: "45",
    wipe_tower_x: ["165"],
    wipe_tower_y: ["241"],
    draft_shield: "disabled",
    skirt_distance: "2",
    skirt_height: "1",
    elephant_foot_compensation: "0.15",

    // Ironing (off by default)
    ironing_type: "no ironing",
    ironing_pattern: "zig-zag",
    ironing_spacing: "0.15",
    ironing_speed: "30",
    ironing_flow: "10%",
    ironing_direction: "45",

    // G-code flavour
    gcode_flavor: "marlin",

    // Machine start/end gcode (minimal placeholders — BambuStudio uses these)
    machine_start_gcode: "; generated by Puzzle Studio 3D\nG28 ; home all axes",
    machine_end_gcode: "; generated by Puzzle Studio 3D\nM400\nG1 Z{max_layer_z + 0.5} F900\nM104 S0\nM140 S0\nG28 X Y",
    machine_pause_gcode: "M400 U1",
    before_layer_change_gcode: "",
    layer_change_gcode: "; layer num/total_layer_count: {layer_num+1}/[total_layer_count]",

    // Thumbnail
    thumbnail_size: ["50x50"],

    // Timelapse
    timelapse_type: "0",

    // Misc
    enable_arc_fitting: "1",
    enable_pressure_advance: ["0"],
    pressure_advance: ["0.02"],
    exclude_object: "1",
    scan_first_layer: "0",
    sparse_infill_anchor: "400%",
    sparse_infill_anchor_max: "20",
    interface_shells: "0",
    detect_overhang_wall: "1",
    detect_narrow_internal_solid_infill: "1",
    reduce_crossing_wall: "0",
    reduce_infill_retraction: "1",
    infill_combination: "0",
    infill_direction: "45",
    infill_wall_overlap: "15%",
    minimum_sparse_infill_area: "15",
    sparse_infill_filament: "1",
    solid_infill_filament: "1",
    wall_filament: "1",
    support_filament: "0",
    support_interface_filament: "0",
    support_air_filtration: "0",
    support_chamber_temp_control: "0",
    activate_air_filtration: ["0"],
    during_print_exhaust_fan_speed: ["70"],
    complete_print_exhaust_fan_speed: ["70"],
    additional_cooling_fan_speed: ["70"],

    // Upward compatibility
    upward_compatible_machine: [
      "Bambu Lab P1P 0.4 nozzle",
      "Bambu Lab X1 0.4 nozzle",
      "Bambu Lab X1 Carbon 0.4 nozzle",
      "Bambu Lab X1E 0.4 nozzle",
      "Bambu Lab A1 0.4 nozzle",
    ],
  };

  return JSON.stringify(settings, null, 4);
}

/**
 * Generate model_settings.config XML for BambuStudio.
 * Defines object metadata and plate layout.
 */
function buildModelSettingsConfig(
  items: Array<{ name: string; objId: number }>,
  filaments: FilamentDefinition[]
): string {
  const filCount = filaments.length;

  const objectEntries = items.map(item => {
    const safeName = xmlAttr(item.name);
    return `  <object id="${item.objId}">
    <metadata key="name" value="${safeName}"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="${safeName}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
    </part>
  </object>`;
  }).join("\n");

  const modelInstances = items.map((item, idx) => `    <model_instance>
      <metadata key="object_id" value="${item.objId}"/>
      <metadata key="instance_id" value="${idx}"/>
      <metadata key="identify_id" value="${idx + 1}"/>
    </model_instance>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
${objectEntries}
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="Plate 1"/>
    <metadata key="locked" value="false"/>
    <metadata key="print_sequence" value="by layer"/>
    <filament_list>
      ${Array.from({ length: filCount }, (_, i) => `<metadata key="filament_id" value="${i + 1}"/>`).join("\n      ")}
    </filament_list>
${modelInstances}
  </plate>
</config>`;
}

/**
 * Builds and packages a valid .3MF zip archive with full multi-color metadata
 * Compatible with Bambu Studio, OrcaSlicer, PrusaSlicer
 */
export async function generate3MfBlob(options: ThreeMfExportOptions): Promise<Blob> {
  const zip = new JSZip();
  const title = options.title || "Puzzle 3D Multi-Color";
  const filaments = options.filaments && options.filaments.length > 0
    ? options.filaments
    : [{ name: "Filamento 1", color: "#00E5FF" }];
  const unit = options.unit || "millimeter";

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  zip.file("[Content_Types].xml", contentTypesXml);

  // 2. _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  zip.file("_rels/.rels", relsXml);

  // 3. 3D/3dmodel.model
  // Base materials for slicer (must come first in resources for Bambu Studio)
  const baseMaterialElements = filaments.map(f =>
    `      <base name="${f.name.replace(/"/g, "'")}" displaycolor="${normalizeColor(f.color)}" />`
  ).join("\n");

  const objectsXmlList: string[] = [];
  const buildItemsList: string[] = [];
  const settingsObjects: Array<{ name: string; objId: number }> = [];

  // Object IDs start at 1 (required by Bambu Studio)
  let nextObjectId = 1;
  const basematerialsId = 1;

  options.items.forEach((item, idx) => {
    const objId = nextObjectId++;
    const safeName = (item.name || `Object_${idx + 1}`).replace(/[<>&"]/g, "_");
    const filIdx = Math.max(0, Math.min(item.filamentIndex ?? 0, filaments.length - 1));

    const { verticesXml, trianglesXml } = geometryTo3MfMesh(item.geometry, filIdx, basematerialsId);

    // Each object references basematerials with pid and pindex
    const objXml = `    <object id="${objId}" name="${safeName}" type="model" pid="${basematerialsId}" pindex="${filIdx}">
      <mesh>
        <vertices>
        ${verticesXml}
        </vertices>
        <triangles>
        ${trianglesXml}
        </triangles>
      </mesh>
    </object>`;

    objectsXmlList.push(objXml);
    settingsObjects.push({ name: safeName, objId });

    // Build item with transform if needed
    let transformAttr = "";
    if (item.position || item.rotation) {
      const pos = item.position || [0, 0, 0];
      transformAttr = ` transform="1 0 0 0 1 0 0 0 1 ${pos[0]} ${pos[1]} ${pos[2]}"`;
    }

    buildItemsList.push(`    <item objectid="${objId}"${transformAttr} />`);
  });

  const safeTitle = xmlAttr(title.replace(/[<>&"]/g, "_"));

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="${unit}" xml:lang="pt-BR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">
  <metadata name="Application">BambuStudio-02.05.00.66</metadata>
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <metadata name="Title">${safeTitle}</metadata>
  <metadata name="Designer">${xmlAttr((options.designer || "Vertice Studio").replace(/[<>&"]/g, "_"))}</metadata>
  <resources>
    <basematerials id="${basematerialsId}">
${baseMaterialElements}
    </basematerials>
${objectsXmlList.join("\n")}
  </resources>
  <build>
${buildItemsList.join("\n")}
  </build>
</model>`;

  zip.file("3D/3dmodel.model", modelXml);

  // 4. Metadata/project_settings.config — essential BambuStudio print settings
  const projectSettings = buildProjectSettingsConfig(filaments);
  zip.file("Metadata/project_settings.config", projectSettings);

  // 5. Metadata/model_settings.config — object placement and plate info
  const modelSettings = buildModelSettingsConfig(settingsObjects, filaments);
  zip.file("Metadata/model_settings.config", modelSettings);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}
