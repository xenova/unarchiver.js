
# Define directories
SRCDIR = src
DISTDIR = dist
BUILDDIR = build
LIBDIR = lib

# Define target files
JS_FILES= $(patsubst $(SRCDIR)/%.js, $(DISTDIR)/%.min.js, $(wildcard $(SRCDIR)/*.js $(SRCDIR)/$(LIBDIR)/*.js))

# Define variables
MEMFILE = $(LIBDIR)/libunrar.js.mem
MAIN = unarchiver

.PHONY: minify clean run
.SUFFIXES: .min.js .js

default: build

build: minify
	cd $(DISTDIR) && zip -FSr ../$(BUILDDIR)/$(MAIN).zip *

minify: $(JS_FILES)
	@sed -i 's/const DIST=!1/const DIST=1/g' $(DISTDIR)/$(MAIN).min.js
	@cp -u $(SRCDIR)/$(MEMFILE) $(DISTDIR)/$(MEMFILE)

$(DISTDIR)/%.min.js: $(SRCDIR)/%.js
	uglifyjs --compress --mangle -o $@ $< 

clean:
	rm -f $(JS_FILES) $(DISTDIR)/$(MEMFILE)

run:
	python -m http.server
