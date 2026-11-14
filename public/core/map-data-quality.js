// Customs camera quest: the provider also returns legacy numeric-ID copies of its three cameras.
// Only remove a description-less legacy copy when the richer record identifies the same photo
// or the same nearby object. Never combine unrelated extracts, floors or ordinary loot markers.
export function canonicalQuestLayer(layer) {
  if (layer?.questData?.normalizedName !== "halloween-blind-the-enemy") return layer;
  const markers=layer.objectiveMarkers||[];
  const described=markers.filter(marker=>Array.isArray(marker.objDescription) && marker.objDescription.some(Boolean));
  const objectives=markers.filter(marker=>{
    if(!/^\d+$/.test(String(marker.id)) || marker.objDescription?.some(Boolean))return true;
    return !described.some(other=>{
      const sameImage=marker.pointImages?.some(image=>other.pointImages?.includes(image));
      const distance=Math.hypot(marker.position?.x-other.position?.x,marker.position?.z-other.position?.z);
      return sameImage || (distance<1 && (marker.name===other.name || !marker.pointImages?.length));
    });
  });
  return objectives.length===markers.length?layer:{...layer,objectiveMarkers:objectives};
}
