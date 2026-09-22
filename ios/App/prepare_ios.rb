# 뱃일 — 아이폰 빌드 전에 Xcode 프로젝트를 맞춘다 (6.0)
#   ① 권한 안내문을 기기 언어에 맞춰 띄우도록 InfoPlist.strings(ko·en·ja·ru)를 프로젝트에 넣는다.
#      파일만 폴더에 두면 앱에 안 들어간다(GoogleService-Info.plist 때 겪은 것과 같은 까닭).
#   ② knownRegions 에 ko·ja·ru 를 넣는다.
# 여러 번 돌려도 같은 결과가 나오게 만든다.
require 'xcodeproj'
proj = Xcodeproj::Project.open(File.join(__dir__, 'App.xcodeproj'))
app  = proj.targets.find { |t| t.name == 'App' } or raise 'App 타겟 없음'
grp  = proj.main_group.find_subpath('App', false) or raise 'App 그룹 없음'
langs = %w[ko en ja ru]
vg = grp.children.find { |c| c.isa == 'PBXVariantGroup' && c.name == 'InfoPlist.strings' }
unless vg
  vg = proj.new(Xcodeproj::Project::Object::PBXVariantGroup)
  vg.name = 'InfoPlist.strings'
  vg.source_tree = '<group>'
  grp.children << vg
end
langs.each do |l|
  path = "#{l}.lproj/InfoPlist.strings"
  raise "#{path} 파일이 없음" unless File.exist?(File.join(__dir__, 'App', path))
  next if vg.children.any? { |f| f.path == path }
  ref = proj.new(Xcodeproj::Project::Object::PBXFileReference)
  ref.name = l
  ref.path = path
  ref.last_known_file_type = 'text.plist.strings'
  ref.source_tree = '<group>'
  vg.children << ref
end
res = app.resources_build_phase
res.add_file_reference(vg, true) unless res.files_references.include?(vg)
root = proj.root_object
root.known_regions = (root.known_regions + langs + ['Base']).uniq
proj.save
puts "InfoPlist.strings #{vg.children.map(&:name).join(',')} · knownRegions #{root.known_regions.join(',')}"
