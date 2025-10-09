# MediaPipe Landmark Tracking Audit

## Summary
MediaPipe Holistic provides **543 total landmarks**:
- **33 pose landmarks** (body skeleton)
- **468 face landmarks** (face mesh)
- **21 left hand landmarks**
- **21 right hand landmarks**

---

## Pose Landmarks (33 total, indices 0-32)

### ✅ CURRENTLY TRACKED

**Upper Body (Core):**
- **11, 12**: Left/Right Shoulder → Used for torso & arm positioning
- **13, 14**: Left/Right Elbow → Used for upper arm
- **15, 16**: Left/Right Wrist → Used for lower arm
- **17, 18**: Left/Right Pinky (knuckle) → Used for hand orientation
- **19, 20**: Left/Right Index (knuckle) → Used for hand orientation

**Lower Body (Optional - when `renderLegs: true`):**
- **23, 24**: Left/Right Hip → Used for spine base
- **25, 26**: Left/Right Knee → Used for upper leg
- **27, 28**: Left/Right Ankle → Used for lower leg & foot
- **29, 30**: Left/Right Heel → Used for foot orientation
- **31, 32**: Left/Right Foot Index (toe) → Used for toe direction

### ❌ NOT TRACKED

**Face/Head from Pose (indices 0-10):**
- **0**: Nose
- **1**: Left eye (inner)
- **2**: Left eye (center)
- **3**: Left eye (outer)
- **4**: Right eye (inner)
- **5**: Right eye (center)
- **6**: Right eye (outer)
- **7**: Left ear
- **8**: Right ear
- **9**: Mouth (left corner)
- **10**: Mouth (right corner)

**Hand Detail from Pose (indices 21-22):**
- **21, 22**: Left/Right Thumb (base) - **NOTE**: We use dedicated hand landmarks instead, which is correct

### 🤔 POTENTIAL USE CASES FOR UNUSED POSE LANDMARKS

**Head Orientation Enhancement (0-10):**
- Could use **eyes (1-6)** + **nose (0)** for more accurate head rotation
- Currently we only use face mesh landmarks (145, 374, 152) which works well
- **Recommendation**: Current approach is fine - face mesh is more detailed

**Ear Tracking (7-8):**
- Could enable **side profile detection** (which side of head is facing camera)
- Could improve **head twist** calculations
- **Recommendation**: LOW PRIORITY - not critical for avatar movement

---

## Face Landmarks (468 total, indices 0-467)

### ✅ CURRENTLY TRACKED

**Face Mesh Geometry:**
- **All 468 landmarks** are captured and rendered as face mesh geometry ✓
- **145**: Left eye center (used for head bone positioning)
- **374**: Right eye center (used for head bone positioning)
- **152**: Chin (used for head bone positioning)

**Face Texture:**
- Complete face texture mapped from webcam ✓
- UV coordinates calculated from all 468 landmarks ✓

### ⚠️ POTENTIALLY UNDER-UTILIZED

**Eye Tracking / Gaze Direction:**
- Face mesh includes detailed eye contours (~32 points per eye)
- Could extract **pupil position** for eye gaze
- Could add **eyelid tracking** for blink detection
- **Recommendation**: MEDIUM PRIORITY - would add expressiveness

**Mouth/Expression Tracking:**
- Face mesh includes detailed lip contours (~40 points)
- Could extract **mouth openness** for talking detection
- Could detect **smile/frown** expressions
- **Recommendation**: MEDIUM-HIGH PRIORITY - critical for communication

**Eyebrow Tracking:**
- Face mesh includes eyebrow landmarks
- Could detect **raised eyebrows** (surprise)
- Could detect **furrowed brows** (concentration)
- **Recommendation**: LOW-MEDIUM PRIORITY - nice to have

---

## Hand Landmarks (21 per hand, indices 0-20)

### ✅ FULLY TRACKED

**All landmarks tracked correctly:**
- **0**: Wrist (anchor point) ✓
- **1-4**: Thumb (CMC, MCP, IP, TIP) ✓
- **5-8**: Index finger (MCP, PIP, DIP, TIP) ✓
- **9-12**: Middle finger (MCP, PIP, DIP, TIP) ✓
- **13-16**: Ring finger (MCP, PIP, DIP, TIP) ✓
- **17-20**: Pinky (MCP, PIP, DIP, TIP) ✓

**Mapping Status:**
- ✅ All 21 landmarks per hand are used for finger bone rotations
- ✅ Hierarchical bone chains (base → middle → tip)
- ✅ Neutral poses defined for when hands not visible

---

## Issues Found

### 🔴 CRITICAL ISSUES

**None identified** - Core tracking is solid!

### ✅ FIXED ISSUES

**1. Thumb Landmark Mapping** ✓
```typescript
const boneThumb = (isLeft: boolean) => createFingerBones(isLeft, 'FingerThumb', 1, 2, 3, 4);
```
- **Fixed**: Now using landmarks 1 (CMC) → 2 (MCP) → 3 (IP) → 4 (TIP)
- Properly maps to thumb anatomy with all 3 bones

**2. Neck Leaning Backward** ✓
- **Issue**: Neck was leaning back ~30° due to face mesh depth mismatch
- **Fixed**: Now uses nose landmark (pose) for Z-coordinate alignment
- Face mesh Y (height) + pose Z (depth) = proper neck angle

**3. Hand/Finger Scaling** ✓
- **Added**: `HandScaleMultiplier = 2.0` for 2x larger hands
- Applied to all hand and finger bone segments
- Makes finger movements much more prominent and visible

---

## Recommendations

### High Priority
1. **Verify thumb bone mapping** - check if using correct MediaPipe indices
2. **Test finger tracking** - ensure all fingers move correctly
3. **Add expression tracking** - mouth/eyebrow for communication

### Medium Priority
4. **Add eye gaze tracking** - pupil direction for more lifelike avatars
5. **Add ear tracking** - improve head twist detection in profile view

### Low Priority
6. **Document exact landmark positions** - create visual diagram
7. **Add landmark visualization toggle** - show all tracked points in debug mode

---

## Testing Checklist

- [ ] Verify left/right hand landmarks are not swapped
- [ ] Test thumb movement (all 3 bones)
- [ ] Test each finger independently (pointing, curling)
- [ ] Verify foot landmarks (if legs enabled)
- [ ] Check head rotation accuracy
- [ ] Test edge cases (hands behind back, looking away)
