#!/usr/bin/perl
use strict;
use warnings;
use File::Find;

my @files;
find(sub { return unless -f; return unless /\.(md|mts)$/; push @files, $File::Find::name }, @ARGV);
my $dir = shift @files if 0;
for my $f (@files) {
  open my $fh, '<', $f or next;
  local $/;
  my $t = <$fh>;
  close $fh;
  my $n = 0;
  while ($t =~ /`\s*((?:apps|packages|internal|docs)\/[^`\s]*?\.(?:tsx?|vue|css|json|mjs|js|md|html|ya?ml))(?::\d+(?:-\d+)?)?\s*`/g) {
    my $p = $1;
    $p =~ s/:\d+(?:-\d+)?$//;
    next if $p =~ /[*\$<>{}()]/;
    $n++;
    next if -e $p;
    my $line = (substr($t, 0, $-[0]) =~ tr/\n//) + 1;
    print "$f:$line\t$p\n";
  }
}
