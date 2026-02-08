import { useEffect, useRef, useState } from "react";
import { hierarchy } from "d3-hierarchy";
import { treemap } from "d3-hierarchy";
import { select } from "d3-selection";
import type { Department } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { getDepartmentColor } from "@/lib/colors";

export interface Props {
  departments: Department[];
  onDepartmentClick?: (deptId: string) => void;
}

interface TreeNode {
  name: string;
  value?: number;
  id?: string;
  children?: TreeNode[];
}

/**
 * D3 treemap visualization showing departments sized by budget amount.
 */
export default function BudgetTreemap({ departments, onDepartmentClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle responsive resizing
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({ width, height: 600 });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const { width, height } = dimensions;

    // Build D3 hierarchy
    const hierarchyData: TreeNode = {
      name: "Total Budget",
      children: departments.map((dept) => ({
        name: dept.name,
        value: dept.amount,
        id: dept.id,
      })),
    };

    const root = hierarchy<TreeNode>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemapLayout = treemap<TreeNode>().size([width, height]).padding(2).round(true);

    treemapLayout(root);

    // Clear previous content
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    // Create group for each department
    const nodes = svg
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

    // Add rectangles
    nodes
      .append("rect")
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("fill", (_, i) => getDepartmentColor(i))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", onDepartmentClick ? "pointer" : "default")
      .on("click", function (event, d) {
        if (onDepartmentClick && d.data.id) {
          onDepartmentClick(d.data.id);
        }
      })
      .on("mouseenter", function () {
        if (onDepartmentClick) {
          select(this).attr("opacity", 0.8);
        }
      })
      .on("mouseleave", function () {
        select(this).attr("opacity", 1);
      });

    // Add department name labels
    nodes
      .append("text")
      .attr("x", 4)
      .attr("y", 16)
      .text((d) => {
        const width = d.x1 - d.x0;
        // Only show name if box is wide enough
        return width > 80 ? d.data.name : "";
      })
      .attr("font-size", "12px")
      .attr("font-weight", "600")
      .attr("fill", "#fff")
      .style("pointer-events", "none");

    // Add amount labels
    nodes
      .append("text")
      .attr("x", 4)
      .attr("y", 32)
      .text((d) => {
        const width = d.x1 - d.x0;
        // Only show amount if box is wide enough
        return width > 80 && d.value ? formatCurrency(d.value) : "";
      })
      .attr("font-size", "11px")
      .attr("fill", "#fff")
      .style("pointer-events", "none");
  }, [departments, dimensions, onDepartmentClick]);

  return (
    <div ref={containerRef} className="w-full">
      <svg
        ref={svgRef}
        className="w-full"
        style={{ height: dimensions.height }}
        role="img"
        aria-label="Budget treemap showing departments sized by budget amount"
      />
    </div>
  );
}
