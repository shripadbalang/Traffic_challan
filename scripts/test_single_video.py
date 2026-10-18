import os
import sys
import time
import cv2

raw_video_arg = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "test-assets", "samples", "test.mp4")
target_video_path = os.path.abspath(raw_video_arg)

# Add ml-service to path
ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml-service"))
sys.path.insert(0, ml_service_dir)
os.chdir(ml_service_dir)

from app.detect import process_image, process_video, _annotate_frame_image
from app.config import settings

def test_video(video_path: str):
    video_path = os.path.abspath(video_path)
    print("=" * 70)
    print("  VIDEO DETECTION & OCR TEST")
    print("=" * 70)
    print(f"Target Video : {os.path.abspath(video_path)}")
    if not os.path.exists(video_path):
        print(f"Error: Video file '{video_path}' does not exist.")
        return

    file_size = os.path.getsize(video_path)
    print(f"File Size    : {file_size:,} bytes")

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    print(f"Resolution   : {w}x{h} @ {fps:.1f} FPS")
    print(f"Duration     : {duration:.2f}s ({total_frames} frames)")
    sample_rate = settings.VIDEO_FRAME_SAMPLE_RATE
    sampled_count = total_frames // sample_rate
    print(f"Sample Rate  : Every {sample_rate} frames (~{sampled_count} frames to process)")
    print("-" * 70)

    print("\nRunning frame-by-frame analysis...")
    start_time = time.time()

    cap = cv2.VideoCapture(video_path)
    frame_idx = 0
    processed_count = 0
    all_violations = set()
    all_detected_plates = {}
    viol_plate_map = {}
    frame_results = []
    best_frame_bgr = None
    best_frame_info = None

    best_score = -1.0

    while True:
        success, frame = cap.read()
        if not success:
            break
        frame_idx += 1
        if frame_idx % sample_rate != 0:
            continue

        processed_count += 1
        encoded = cv2.imencode(".jpg", frame)[1]
        t0 = time.time()
        res = process_image(encoded.tobytes())
        dt = time.time() - t0

        violations = res.get("violations_found", [])
        plate = res.get("plate_number")
        conf = res.get("plate_confidence")
        det_vehs = res.get("detected_vehicles", [])

        for v in violations:
            all_violations.add(v)

        if plate:
            if plate not in all_detected_plates or (conf and conf > all_detected_plates[plate]["conf"]):
                all_detected_plates[plate] = {"conf": conf, "frame": frame_idx}

        # Check vehicle plates
        for veh in det_vehs:
            vp = veh.get("plate_number")
            vc = veh.get("plate_confidence")
            vviols = veh.get("violations_found", [])
            if vp:
                if vp not in all_detected_plates or (vc and vc > all_detected_plates[vp]["conf"]):
                    all_detected_plates[vp] = {"conf": vc, "frame": frame_idx}
                if vviols:
                    viol_plate_map[vp] = {"conf": vc, "frame": frame_idx, "violations": vviols}

        v_str = ", ".join(violations) if violations else "none"
        p_str = f"{plate} ({conf:.2f})" if plate else "none"
        print(f"  Frame {frame_idx:3d}/{total_frames} | {dt:.2f}s | Violations: {v_str:<30} | Plate: {p_str}")

        frame_score = len(violations) * 100.0 + (10.0 + (conf or 0.0) if plate else 0.0)
        if frame_score > best_score:
            best_score = frame_score
            best_frame_bgr = frame.copy()
            best_frame_info = {
                "frame_idx": frame_idx,
                "violations": violations,
                "plate": plate,
                "conf": conf,
                "boxes": res.get("boxes", []),
                "detected_vehicles": det_vehs,
            }

    cap.release()
    elapsed = time.time() - start_time

    print("\n" + "=" * 70)
    print("  OVERALL VIDEO SUMMARY")
    print("=" * 70)
    print(f"Total Processed Frames: {processed_count}")
    print(f"Processing Time       : {elapsed:.2f}s ({elapsed/max(1, processed_count):.2f}s per frame)")
    print(f"All Violations Found  : {list(all_violations) if all_violations else 'None'}")
    print(f"Unique Plates Found   : {list(all_detected_plates.keys()) if all_detected_plates else 'None'}")
    for p, pinfo in all_detected_plates.items():
        print(f"  - Plate: {p} (conf: {pinfo['conf']}, at frame {pinfo['frame']})")

    # If we have a key frame, save an annotated image of it
    if best_frame_bgr is not None:
        out_annotated = os.path.abspath(os.path.join(os.path.dirname(video_path), "annotated_test_video.jpg"))
        primary_plate = None
        primary_conf = None
        for v in best_frame_info.get("detected_vehicles", []):
            if v.get("violations_found") and v.get("plate_number"):
                primary_plate = v["plate_number"]
                primary_conf = v.get("plate_confidence")
                break
        if not primary_plate and viol_plate_map:
            best_viol_entry = max(viol_plate_map.items(), key=lambda kv: kv[1]["conf"] or 0.0)
            primary_plate = best_viol_entry[0]
            primary_conf = best_viol_entry[1]["conf"]
        elif not primary_plate and all_detected_plates:
            best_p_entry = max(all_detected_plates.items(), key=lambda kv: kv[1]["conf"] or 0.0)
            primary_plate = best_p_entry[0]
            primary_conf = best_p_entry[1]["conf"]

        annotated_img = _annotate_frame_image(
            best_frame_bgr,
            best_frame_info.get("boxes", []),
            list(all_violations),
            primary_plate,
            primary_conf,
            best_frame_info.get("detected_vehicles", []),
        )
        cv2.imwrite(out_annotated, annotated_img)
        print(f"\nKey Violation Frame Saved: {out_annotated}")

        # Also copy to artifacts directory
        artifact_dir = r"C:\Users\shrip\.gemini\antigravity\brain\47919788-ca45-4ada-8381-f602d0d4c135"
        if os.path.exists(artifact_dir):
            import shutil
            shutil.copy2(out_annotated, os.path.join(artifact_dir, "annotated_test_video.jpg"))
            print(f"Artifact Copy Saved: {os.path.join(artifact_dir, 'annotated_test_video.jpg')}")

if __name__ == "__main__":
    test_video(target_video_path)
